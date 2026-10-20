//! `/vidsrc` routes: embed URL building, latest-list proxying and an availability heuristic.

use std::{sync::Arc, time::Duration};

use axum::{Json, Router, extract::State, routing::get};
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    error::{AppError, AppResult},
    extract::{Path, Query, opt_parse},
    state::AppState,
};

pub const LATEST_TIMEOUT: Duration = Duration::from_secs(10);
pub const AVAILABILITY_TIMEOUT: Duration = Duration::from_secs(15);
pub const LATEST_TTL: Duration = Duration::from_secs(5 * 60);
pub const AVAILABILITY_TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmbedKind {
    Movie,
    Tv,
}

impl EmbedKind {
    pub fn as_str(self) -> &'static str {
        match self {
            EmbedKind::Movie => "movie",
            EmbedKind::Tv => "tv",
        }
    }
}

/// Inputs for [`build_embed_url`]. Empty strings are treated as absent.
#[derive(Debug, Clone, Default)]
pub struct EmbedParams {
    pub tmdb: Option<String>,
    pub imdb: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub ds_lang: Option<String>,
    pub sub_url: Option<String>,
    pub autoplay: Option<i64>,
    pub autonext: Option<i64>,
}

fn present(v: &Option<String>) -> Option<&str> {
    v.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

/// Builds `{base}/embed/{kind}[/{id}[/{season}-{episode}]][?query]`.
///
/// - `tmdb` takes precedence over `imdb` for the id path segment.
/// - For TV with an id and both `season` and `episode`, `/{season}-{episode}` is appended.
/// - `ds_lang`, `sub_url`, `autoplay`, `autonext` are appended as a URL-encoded query
///   string, with or without an id.
pub fn build_embed_url(base: &str, kind: EmbedKind, p: &EmbedParams) -> String {
    let base = base.trim_end_matches('/');
    let mut url = format!("{base}/embed/{}", kind.as_str());
    // Blank ids count as absent, so "no id" means neither `tmdb` nor `imdb` has a value and
    // there is nothing to move into the query string.
    if let Some(id) = present(&p.tmdb).or(present(&p.imdb)) {
        url.push('/');
        url.push_str(&urlencoding::encode(id));
        if kind == EmbedKind::Tv
            && let (Some(season), Some(episode)) = (p.season, p.episode)
        {
            url.push_str(&format!("/{season}-{episode}"));
        }
    }

    let mut query = url::form_urlencoded::Serializer::new(String::new());
    if let Some(lang) = present(&p.ds_lang) {
        query.append_pair("ds_lang", lang);
    }
    if let Some(sub) = present(&p.sub_url) {
        query.append_pair("sub_url", sub);
    }
    if let Some(autoplay) = p.autoplay {
        query.append_pair("autoplay", &autoplay.to_string());
    }
    if let Some(autonext) = p.autonext {
        query.append_pair("autonext", &autonext.to_string());
    }
    let qs = query.finish();
    if !qs.is_empty() {
        url.push('?');
        url.push_str(&qs);
    }
    url
}

/// `{base}/info/movie/{id}.json`, `/info/tv/{id}.json` or `/info/tv/{id}/{season}/{episode}.json`.
pub fn build_info_url(
    base: &str,
    kind: EmbedKind,
    id: u32,
    season: Option<u32>,
    episode: Option<u32>,
) -> String {
    let base = base.trim_end_matches('/');
    match (kind, season, episode) {
        (EmbedKind::Tv, Some(s), Some(e)) => format!("{base}/info/tv/{id}/{s}/{e}.json"),
        _ => format!("{base}/info/{}/{id}.json", kind.as_str()),
    }
}

/// Result of probing the Content Info endpoint. Serializes like the Python dict.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EmbedCheck {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embed_url: Option<String>,
}

impl EmbedCheck {
    fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            available: false,
            reason: Some(reason.into()),
            embed_url: None,
        }
    }
}

/// Maps the status of vidsrc's Content Info endpoint to an availability answer: 200 means the
/// title is on the stream, 404 means it is not. (Scraping the embed page cannot tell the two
/// apart: it returns 200 for unknown ids too.)
pub fn classify_info_status(status: u16, embed_url: &str) -> EmbedCheck {
    match status {
        200 => EmbedCheck {
            available: true,
            reason: None,
            embed_url: Some(embed_url.to_string()),
        },
        404 => EmbedCheck::unavailable("not found"),
        other => EmbedCheck::unavailable(format!("HTTP {other}")),
    }
}

#[derive(Debug, Serialize)]
pub struct AvailabilityResponse {
    #[serde(flatten)]
    pub check: EmbedCheck,
    pub tmdb_id: u32,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub season: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub episode: Option<u32>,
}

#[derive(Clone)]
pub struct VidsrcClient {
    http: reqwest::Client,
    base_url: String,
    latest_cache: Cache<String, Arc<Value>>,
    availability_cache: Cache<String, EmbedCheck>,
}

impl VidsrcClient {
    pub fn new(http: reqwest::Client, base_url: impl Into<String>) -> Self {
        Self {
            http,
            base_url: base_url.into().trim_end_matches('/').to_string(),
            latest_cache: Cache::builder()
                .max_capacity(1_000)
                .time_to_live(LATEST_TTL)
                .build(),
            availability_cache: Cache::builder()
                .max_capacity(20_000)
                .time_to_live(AVAILABILITY_TTL)
                .build(),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn embed_url(&self, kind: EmbedKind, p: &EmbedParams) -> String {
        build_embed_url(&self.base_url, kind, p)
    }

    /// Proxies `{base}/{movies|tvshows}/latest/page-{page}.json`, cached for 5 minutes.
    pub async fn latest(&self, list: &str, page: u32) -> AppResult<Arc<Value>> {
        let url = format!("{}/{list}/latest/page-{page}.json", self.base_url);
        self.latest_cache
            .try_get_with(url.clone(), async {
                let resp = self
                    .http
                    .get(&url)
                    .timeout(LATEST_TIMEOUT)
                    .send()
                    .await
                    .map_err(|e| AppError::from_transport(&e))?;
                let status = resp.status();
                if !status.is_success() {
                    let body = resp.text().await.unwrap_or_default();
                    return Err(AppError::Upstream { status, body });
                }
                let v: Value = resp
                    .json()
                    .await
                    .map_err(|e| AppError::from_transport(&e))?;
                Ok(Arc::new(v))
            })
            .await
            .map_err(|e| (*e).clone())
    }

    pub fn info_url(
        &self,
        kind: EmbedKind,
        id: u32,
        season: Option<u32>,
        episode: Option<u32>,
    ) -> String {
        build_info_url(&self.base_url, kind, id, season, episode)
    }

    /// Asks the Content Info endpoint whether a title is on the stream. Definitive answers are
    /// cached for 30 minutes per URL; transport failures (timeouts, connection errors) are not
    /// cached so they are retried next time.
    pub async fn check_availability(&self, info_url: &str, embed_url: &str) -> EmbedCheck {
        // `probe` returns transport failures as `Err`, which moka does not cache.
        let result = self
            .availability_cache
            .try_get_with(info_url.to_string(), self.probe(info_url, embed_url))
            .await;
        match result {
            Ok(check) => check,
            Err(transient) => (*transient).clone(),
        }
    }

    async fn probe(&self, info_url: &str, embed_url: &str) -> Result<EmbedCheck, EmbedCheck> {
        let resp = self
            .http
            .get(info_url)
            .timeout(AVAILABILITY_TIMEOUT)
            .send()
            .await
            .map_err(|e| transport_check(&e))?;
        Ok(classify_info_status(resp.status().as_u16(), embed_url))
    }
}

fn transport_check(err: &reqwest::Error) -> EmbedCheck {
    if err.is_timeout() {
        EmbedCheck::unavailable("timeout")
    } else {
        EmbedCheck::unavailable(err.to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct MovieEmbedQuery {
    pub tmdb: Option<String>,
    pub imdb: Option<String>,
    pub ds_lang: Option<String>,
    pub sub_url: Option<String>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub autoplay: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct TvEmbedQuery {
    pub tmdb: Option<String>,
    pub imdb: Option<String>,
    pub ds_lang: Option<String>,
    pub sub_url: Option<String>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub autoplay: Option<i64>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub season: Option<u32>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub episode: Option<u32>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub autonext: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct LatestQuery {
    #[serde(default, deserialize_with = "opt_parse")]
    pub page: Option<u32>,
}

#[derive(Debug, Default, Deserialize)]
pub struct TvAvailabilityQuery {
    #[serde(default, deserialize_with = "opt_parse")]
    pub season: Option<u32>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub episode: Option<u32>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/embed/movie", get(embed_movie))
        .route("/embed/tv", get(embed_tv))
        .route("/latest/movies", get(latest_movies))
        .route("/latest/tvshows", get(latest_tvshows))
        .route("/movie/availability/{id}", get(movie_availability))
        .route("/tv/availability/{id}", get(tv_availability))
}

async fn embed_movie(
    State(state): State<AppState>,
    Query(q): Query<MovieEmbedQuery>,
) -> Json<Value> {
    let params = EmbedParams {
        tmdb: q.tmdb,
        imdb: q.imdb,
        ds_lang: q.ds_lang,
        sub_url: q.sub_url,
        autoplay: q.autoplay,
        ..Default::default()
    };
    Json(json!({ "embed_url": state.vidsrc.embed_url(EmbedKind::Movie, &params) }))
}

async fn embed_tv(State(state): State<AppState>, Query(q): Query<TvEmbedQuery>) -> Json<Value> {
    let params = EmbedParams {
        tmdb: q.tmdb,
        imdb: q.imdb,
        season: q.season,
        episode: q.episode,
        ds_lang: q.ds_lang,
        sub_url: q.sub_url,
        autoplay: q.autoplay,
        autonext: q.autonext,
    };
    Json(json!({ "embed_url": state.vidsrc.embed_url(EmbedKind::Tv, &params) }))
}

async fn latest_movies(
    State(state): State<AppState>,
    Query(q): Query<LatestQuery>,
) -> AppResult<Json<Arc<Value>>> {
    Ok(Json(
        state.vidsrc.latest("movies", q.page.unwrap_or(1)).await?,
    ))
}

async fn latest_tvshows(
    State(state): State<AppState>,
    Query(q): Query<LatestQuery>,
) -> AppResult<Json<Arc<Value>>> {
    Ok(Json(
        state.vidsrc.latest("tvshows", q.page.unwrap_or(1)).await?,
    ))
}

async fn movie_availability(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Json<AvailabilityResponse> {
    let params = EmbedParams {
        tmdb: Some(id.to_string()),
        ..Default::default()
    };
    let url = state.vidsrc.embed_url(EmbedKind::Movie, &params);
    let info = state.vidsrc.info_url(EmbedKind::Movie, id, None, None);
    let check = state.vidsrc.check_availability(&info, &url).await;
    Json(AvailabilityResponse {
        check,
        tmdb_id: id,
        kind: "movie",
        season: None,
        episode: None,
    })
}

async fn tv_availability(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Query(q): Query<TvAvailabilityQuery>,
) -> Json<AvailabilityResponse> {
    let params = EmbedParams {
        tmdb: Some(id.to_string()),
        season: q.season,
        episode: q.episode,
        ..Default::default()
    };
    let url = state.vidsrc.embed_url(EmbedKind::Tv, &params);
    let info = state
        .vidsrc
        .info_url(EmbedKind::Tv, id, q.season, q.episode);
    let check = state.vidsrc.check_availability(&info, &url).await;
    Json(AvailabilityResponse {
        check,
        tmdb_id: id,
        kind: "tv",
        season: q.season,
        episode: q.episode,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "https://vidsrc.sh";

    fn s(v: &str) -> Option<String> {
        Some(v.to_string())
    }

    #[test]
    fn doc_example_movie() {
        let p = EmbedParams {
            tmdb: s("550"),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &p),
            "https://vidsrc.sh/embed/movie/550"
        );
    }

    #[test]
    fn doc_example_tv() {
        let p = EmbedParams {
            tmdb: s("1399"),
            season: Some(1),
            episode: Some(2),
            autonext: Some(1),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Tv, &p),
            "https://vidsrc.sh/embed/tv/1399/1-2?autonext=1"
        );
    }

    #[test]
    fn tmdb_takes_precedence_over_imdb() {
        let p = EmbedParams {
            tmdb: s("550"),
            imdb: s("tt0137523"),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &p),
            format!("{BASE}/embed/movie/550")
        );
        let p = EmbedParams {
            tmdb: s(""),
            imdb: s("tt0137523"),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &p),
            format!("{BASE}/embed/movie/tt0137523")
        );
    }

    #[test]
    fn optional_params_are_url_encoded_even_with_id() {
        let p = EmbedParams {
            tmdb: s("550"),
            ds_lang: s("de"),
            sub_url: s("https://subs.example/a b.vtt"),
            autoplay: Some(0),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &p),
            "https://vidsrc.sh/embed/movie/550?ds_lang=de&sub_url=https%3A%2F%2Fsubs.example%2Fa+b.vtt&autoplay=0"
        );
    }

    #[test]
    fn tv_without_both_season_and_episode_has_no_suffix() {
        let p = EmbedParams {
            tmdb: s("1399"),
            season: Some(1),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Tv, &p),
            format!("{BASE}/embed/tv/1399")
        );
    }

    #[test]
    fn movie_ignores_season_episode() {
        let p = EmbedParams {
            tmdb: s("550"),
            season: Some(1),
            episode: Some(2),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &p),
            format!("{BASE}/embed/movie/550")
        );
    }

    #[test]
    fn no_id_falls_back_to_query_and_bare_base() {
        let p = EmbedParams {
            season: Some(1),
            episode: Some(2),
            autoplay: Some(1),
            ..Default::default()
        };
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Tv, &p),
            format!("{BASE}/embed/tv?autoplay=1")
        );
        assert_eq!(
            build_embed_url(BASE, EmbedKind::Movie, &EmbedParams::default()),
            format!("{BASE}/embed/movie")
        );
    }

    #[test]
    fn info_urls() {
        assert_eq!(
            build_info_url(BASE, EmbedKind::Movie, 550, None, None),
            format!("{BASE}/info/movie/550.json")
        );
        assert_eq!(
            build_info_url(BASE, EmbedKind::Tv, 1399, None, None),
            format!("{BASE}/info/tv/1399.json")
        );
        assert_eq!(
            build_info_url(BASE, EmbedKind::Tv, 1399, Some(1), Some(2)),
            format!("{BASE}/info/tv/1399/1/2.json")
        );
        // an episode needs both numbers; otherwise ask about the whole series
        assert_eq!(
            build_info_url(BASE, EmbedKind::Tv, 1399, Some(1), None),
            format!("{BASE}/info/tv/1399.json")
        );
    }

    #[test]
    fn classify_info_status_maps_statuses() {
        let ok = classify_info_status(200, "u");
        assert!(ok.available);
        assert_eq!(ok.embed_url.as_deref(), Some("u"));
        assert_eq!(
            classify_info_status(404, "u"),
            EmbedCheck::unavailable("not found")
        );
        assert_eq!(
            classify_info_status(503, "u"),
            EmbedCheck::unavailable("HTTP 503")
        );
    }

    #[test]
    fn availability_serializes_like_python() {
        let r = AvailabilityResponse {
            check: classify_info_status(200, "u"),
            tmdb_id: 1,
            kind: "tv",
            season: Some(2),
            episode: None,
        };
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            json!({"available": true, "embed_url": "u", "tmdb_id": 1, "type": "tv", "season": 2})
        );
    }
}
