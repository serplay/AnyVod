//! `/tmdb` routes. Most responses are TMDB bodies passed through unchanged.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderValue, header},
    response::{IntoResponseParts, ResponseParts},
    routing::{MethodRouter, get},
};
use serde::Deserialize;
use serde_json::Value;

use crate::{
    error::{AppError, AppResult},
    extract::{MAX_PAGE, Path, Query, checked_page, checked_rating, opt_parse},
    state::AppState,
};

use super::{
    client::CacheTtl,
    search::{SearchParams, search},
};

type JsonResult = AppResult<Json<Arc<Value>>>;
type CachedJsonResult = AppResult<(CacheFor, Json<Arc<Value>>)>;

/// Browser/CDN cache lifetimes for data that changes slowly. Everything else gets the
/// router-wide default (`CACHE_CONTROL_VALUE`, 5 minutes).
const GENRES_CACHE: &str = "public, max-age=86400";
const PERSON_CACHE: &str = "public, max-age=3600";

/// Sets `Cache-Control` on a response; the router's default only fills it in when absent.
struct CacheFor(&'static str);

impl IntoResponseParts for CacheFor {
    type Error = std::convert::Infallible;

    fn into_response_parts(self, mut res: ResponseParts) -> Result<ResponseParts, Self::Error> {
        res.headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static(self.0));
        Ok(res)
    }
}

const DETAIL_APPEND: &str = "credits,images,videos";

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrendingMediaType {
    All,
    Movie,
    Tv,
    Person,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimeWindow {
    Day,
    Week,
}

impl TrendingMediaType {
    fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Movie => "movie",
            Self::Tv => "tv",
            Self::Person => "person",
        }
    }
}

impl TimeWindow {
    fn as_str(self) -> &'static str {
        match self {
            Self::Day => "day",
            Self::Week => "week",
        }
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct PageParams {
    #[serde(default, deserialize_with = "opt_parse")]
    pub page: Option<u32>,
}

impl PageParams {
    fn page(&self) -> AppResult<String> {
        Ok(checked_page(self.page, MAX_PAGE)?.to_string())
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct DiscoverParams {
    #[serde(default, deserialize_with = "opt_parse")]
    pub page: Option<u32>,
    #[serde(default)]
    pub sort_by: Option<String>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub min_rating: Option<f64>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub max_rating: Option<f64>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub year: Option<u32>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub genre: Option<u32>,
    #[serde(default)]
    pub with_genres: Option<String>,
}

#[derive(Debug, Clone, Copy)]
enum DiscoverKind {
    Movie,
    Tv,
}

impl DiscoverKind {
    /// Fields TMDB's discover endpoint can sort by (each with `.asc` / `.desc`).
    fn sort_fields(self) -> &'static [&'static str] {
        const COMMON: [&str; 3] = ["popularity", "vote_average", "vote_count"];
        match self {
            DiscoverKind::Movie => &[
                COMMON[0],
                COMMON[1],
                COMMON[2],
                "primary_release_date",
                "revenue",
                "title",
                "original_title",
            ],
            DiscoverKind::Tv => &[
                COMMON[0],
                COMMON[1],
                COMMON[2],
                "first_air_date",
                "name",
                "original_name",
            ],
        }
    }

    fn is_valid_sort(self, sort_by: &str) -> bool {
        sort_by.rsplit_once('.').is_some_and(|(field, dir)| {
            matches!(dir, "asc" | "desc") && self.sort_fields().contains(&field)
        })
    }
}

/// `with_genres`: ids joined by `,` (all of) or `|` (any of), e.g. `28,12` or `18|35`.
fn is_valid_genre_list(raw: &str) -> bool {
    raw.len() <= 200
        && raw
            .split([',', '|'])
            .all(|id| !id.is_empty() && id.len() <= 7 && id.bytes().all(|b| b.is_ascii_digit()))
}

const MIN_YEAR: u32 = 1870;
const MAX_YEAR: u32 = 2100;

impl DiscoverParams {
    /// Upstream params, mirroring the Python handler (falsy values are omitted).
    /// Invalid values are rejected with 400 before anything is sent upstream.
    fn to_upstream(&self, kind: DiscoverKind) -> AppResult<Vec<(&'static str, String)>> {
        let sort_by = self
            .sort_by
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("popularity.desc");
        if !kind.is_valid_sort(sort_by) {
            return Err(AppError::BadRequest(format!(
                "sort_by must be one of {} followed by .asc or .desc",
                kind.sort_fields().join(", ")
            )));
        }
        let mut params = vec![
            ("page", checked_page(self.page, MAX_PAGE)?.to_string()),
            ("sort_by", sort_by.to_string()),
        ];
        if let Some(min) = checked_rating("min_rating", self.min_rating)?.filter(|v| *v != 0.0) {
            params.push(("vote_average.gte", min.to_string()));
        }
        if let Some(max) = checked_rating("max_rating", self.max_rating)?.filter(|v| *v != 0.0) {
            params.push(("vote_average.lte", max.to_string()));
        }
        if let Some(year) = self.year.filter(|v| *v != 0) {
            if !(MIN_YEAR..=MAX_YEAR).contains(&year) {
                return Err(AppError::BadRequest(format!(
                    "year must be between {MIN_YEAR} and {MAX_YEAR}"
                )));
            }
            let key = match kind {
                DiscoverKind::Movie => "primary_release_year",
                DiscoverKind::Tv => "first_air_date_year",
            };
            params.push((key, year.to_string()));
        }
        if let Some(genre) = self.genre.filter(|v| *v != 0) {
            params.push(("with_genres", genre.to_string()));
        } else if let Some(with) = self
            .with_genres
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            if !is_valid_genre_list(with) {
                return Err(AppError::BadRequest(
                    "with_genres must be genre ids separated by `,` or `|`".into(),
                ));
            }
            params.push(("with_genres", with.to_string()));
        }
        Ok(params)
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/trending/{media_type}/{time_window}", get(trending))
        .route("/popular", list("/movie/popular"))
        .route("/movie/popular", list("/movie/popular"))
        .route("/movie/top_rated", list("/movie/top_rated"))
        .route("/movie/upcoming", list("/movie/upcoming"))
        .route("/movie/now_playing", list("/movie/now_playing"))
        .route("/tv/popular", list("/tv/popular"))
        .route("/tv/top_rated", list("/tv/top_rated"))
        .route("/tv/on_the_air", list("/tv/on_the_air"))
        .route("/movie/{id}", get(movie_details))
        .route("/tv/{id}", get(tv_details))
        .route("/movie/{id}/similar", get(movie_similar))
        .route("/tv/{id}/similar", get(tv_similar))
        .route("/tv/{id}/season/{season}", get(tv_season))
        .route("/genres/movie", get(movie_genres))
        .route("/genres/tv", get(tv_genres))
        .route("/person/{id}", get(person_details))
        .route("/person/{id}/combined_credits", get(person_credits))
        .route("/discover/movie", get(discover_movie))
        .route("/discover/tv", get(discover_tv))
        .route("/search", get(search_handler))
}

/// A paginated list route that proxies `upstream` with `page`.
fn list(upstream: &'static str) -> MethodRouter<AppState> {
    get(
        move |State(state): State<AppState>, Query(q): Query<PageParams>| async move {
            let v = state.tmdb.get(upstream, &[("page", q.page()?)]).await?;
            Ok::<_, crate::error::AppError>(Json(v))
        },
    )
}

async fn trending(
    State(state): State<AppState>,
    Path((media_type, time_window)): Path<(TrendingMediaType, TimeWindow)>,
) -> JsonResult {
    let path = format!("/trending/{}/{}", media_type.as_str(), time_window.as_str());
    Ok(Json(state.tmdb.get(&path, &[]).await?))
}

async fn movie_details(State(state): State<AppState>, Path(id): Path<u32>) -> JsonResult {
    let params = [("append_to_response", DETAIL_APPEND.to_string())];
    Ok(Json(
        state.tmdb.get(&format!("/movie/{id}"), &params).await?,
    ))
}

async fn tv_details(State(state): State<AppState>, Path(id): Path<u32>) -> JsonResult {
    let params = [("append_to_response", DETAIL_APPEND.to_string())];
    Ok(Json(state.tmdb.get(&format!("/tv/{id}"), &params).await?))
}

async fn movie_similar(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Query(q): Query<PageParams>,
) -> JsonResult {
    let path = format!("/movie/{id}/similar");
    Ok(Json(state.tmdb.get(&path, &[("page", q.page()?)]).await?))
}

async fn tv_similar(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Query(q): Query<PageParams>,
) -> JsonResult {
    let path = format!("/tv/{id}/similar");
    Ok(Json(state.tmdb.get(&path, &[("page", q.page()?)]).await?))
}

async fn tv_season(
    State(state): State<AppState>,
    Path((id, season)): Path<(u32, u32)>,
) -> JsonResult {
    let path = format!("/tv/{id}/season/{season}");
    Ok(Json(state.tmdb.get(&path, &[]).await?))
}

async fn movie_genres(State(state): State<AppState>) -> CachedJsonResult {
    let v = state
        .tmdb
        .get_with_ttl("/genre/movie/list", &[], CacheTtl::Long)
        .await?;
    Ok((CacheFor(GENRES_CACHE), Json(v)))
}

async fn tv_genres(State(state): State<AppState>) -> CachedJsonResult {
    let v = state
        .tmdb
        .get_with_ttl("/genre/tv/list", &[], CacheTtl::Long)
        .await?;
    Ok((CacheFor(GENRES_CACHE), Json(v)))
}

async fn person_details(State(state): State<AppState>, Path(id): Path<u32>) -> CachedJsonResult {
    let v = state.tmdb.get(&format!("/person/{id}"), &[]).await?;
    Ok((CacheFor(PERSON_CACHE), Json(v)))
}

async fn person_credits(State(state): State<AppState>, Path(id): Path<u32>) -> CachedJsonResult {
    let path = format!("/person/{id}/combined_credits");
    Ok((
        CacheFor(PERSON_CACHE),
        Json(state.tmdb.get(&path, &[]).await?),
    ))
}

async fn discover_movie(
    State(state): State<AppState>,
    Query(q): Query<DiscoverParams>,
) -> JsonResult {
    let params = q.to_upstream(DiscoverKind::Movie)?;
    Ok(Json(state.tmdb.get("/discover/movie", &params).await?))
}

async fn discover_tv(State(state): State<AppState>, Query(q): Query<DiscoverParams>) -> JsonResult {
    let params = q.to_upstream(DiscoverKind::Tv)?;
    Ok(Json(state.tmdb.get("/discover/tv", &params).await?))
}

async fn search_handler(
    State(state): State<AppState>,
    Query(q): Query<SearchParams>,
) -> AppResult<Json<Value>> {
    Ok(Json(search(&state.tmdb, q).await?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get<'a>(p: &'a [(&str, String)], k: &str) -> Option<&'a str> {
        p.iter().find(|(key, _)| *key == k).map(|(_, v)| v.as_str())
    }

    #[test]
    fn discover_defaults() {
        let p = DiscoverParams::default()
            .to_upstream(DiscoverKind::Movie)
            .unwrap();
        assert_eq!(get(&p, "page"), Some("1"));
        assert_eq!(get(&p, "sort_by"), Some("popularity.desc"));
        assert_eq!(p.len(), 2);
    }

    #[test]
    fn discover_genre_wins_over_with_genres() {
        let q = DiscoverParams {
            genre: Some(28),
            with_genres: Some("12,18".into()),
            year: Some(2001),
            min_rating: Some(6.5),
            max_rating: Some(0.0),
            ..Default::default()
        };
        let movie = q.to_upstream(DiscoverKind::Movie).unwrap();
        assert_eq!(get(&movie, "with_genres"), Some("28"));
        assert_eq!(get(&movie, "primary_release_year"), Some("2001"));
        assert_eq!(get(&movie, "vote_average.gte"), Some("6.5"));
        assert_eq!(get(&movie, "vote_average.lte"), None);
        let tv = q.to_upstream(DiscoverKind::Tv).unwrap();
        assert_eq!(get(&tv, "first_air_date_year"), Some("2001"));
    }

    #[test]
    fn discover_sort_is_validated_per_kind() {
        assert!(DiscoverKind::Movie.is_valid_sort("revenue.desc"));
        assert!(DiscoverKind::Tv.is_valid_sort("first_air_date.asc"));
        assert!(!DiscoverKind::Tv.is_valid_sort("revenue.desc"));
        assert!(!DiscoverKind::Movie.is_valid_sort("popularity"));
        assert!(!DiscoverKind::Movie.is_valid_sort("popularity.sideways"));
        assert!(!DiscoverKind::Movie.is_valid_sort("x&api_key=1.desc"));
    }

    #[test]
    fn discover_rejects_bad_values() {
        let bad = [
            DiscoverParams {
                page: Some(501),
                ..Default::default()
            },
            DiscoverParams {
                min_rating: Some(12.0),
                ..Default::default()
            },
            DiscoverParams {
                year: Some(99),
                ..Default::default()
            },
            DiscoverParams {
                with_genres: Some("28,,12".into()),
                ..Default::default()
            },
            DiscoverParams {
                with_genres: Some("28;drop".into()),
                ..Default::default()
            },
        ];
        for q in bad {
            assert!(q.to_upstream(DiscoverKind::Movie).is_err(), "{q:?}");
        }
        let ok = DiscoverParams {
            with_genres: Some("18|35".into()),
            ..Default::default()
        };
        assert!(ok.to_upstream(DiscoverKind::Tv).is_ok());
    }
}
