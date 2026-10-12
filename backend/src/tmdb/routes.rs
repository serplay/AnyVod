//! `/tmdb` routes. Most responses are TMDB bodies passed through unchanged.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::State,
    routing::{MethodRouter, get},
};
use serde::Deserialize;
use serde_json::Value;

use crate::{
    error::AppResult,
    extract::{Path, Query, opt_parse},
    state::AppState,
};

use super::{
    client::CacheTtl,
    search::{SearchParams, search},
};

type JsonResult = AppResult<Json<Arc<Value>>>;

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
    fn page(&self) -> String {
        self.page.unwrap_or(1).to_string()
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

impl DiscoverParams {
    /// Upstream params, mirroring the Python handler (falsy values are omitted).
    fn to_upstream(&self, kind: DiscoverKind) -> Vec<(&'static str, String)> {
        let sort_by = self
            .sort_by
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("popularity.desc");
        let mut params = vec![
            ("page", self.page.unwrap_or(1).to_string()),
            ("sort_by", sort_by.to_string()),
        ];
        if let Some(min) = self.min_rating.filter(|v| *v != 0.0) {
            params.push(("vote_average.gte", min.to_string()));
        }
        if let Some(max) = self.max_rating.filter(|v| *v != 0.0) {
            params.push(("vote_average.lte", max.to_string()));
        }
        if let Some(year) = self.year.filter(|v| *v != 0) {
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
            params.push(("with_genres", with.to_string()));
        }
        params
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
            let v = state.tmdb.get(upstream, &[("page", q.page())]).await?;
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
    Ok(Json(state.tmdb.get(&path, &[("page", q.page())]).await?))
}

async fn tv_similar(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Query(q): Query<PageParams>,
) -> JsonResult {
    let path = format!("/tv/{id}/similar");
    Ok(Json(state.tmdb.get(&path, &[("page", q.page())]).await?))
}

async fn tv_season(
    State(state): State<AppState>,
    Path((id, season)): Path<(u32, u32)>,
) -> JsonResult {
    let path = format!("/tv/{id}/season/{season}");
    Ok(Json(state.tmdb.get(&path, &[]).await?))
}

async fn movie_genres(State(state): State<AppState>) -> JsonResult {
    let v = state
        .tmdb
        .get_with_ttl("/genre/movie/list", &[], CacheTtl::Long)
        .await?;
    Ok(Json(v))
}

async fn tv_genres(State(state): State<AppState>) -> JsonResult {
    let v = state
        .tmdb
        .get_with_ttl("/genre/tv/list", &[], CacheTtl::Long)
        .await?;
    Ok(Json(v))
}

async fn person_details(State(state): State<AppState>, Path(id): Path<u32>) -> JsonResult {
    Ok(Json(state.tmdb.get(&format!("/person/{id}"), &[]).await?))
}

async fn person_credits(State(state): State<AppState>, Path(id): Path<u32>) -> JsonResult {
    let path = format!("/person/{id}/combined_credits");
    Ok(Json(state.tmdb.get(&path, &[]).await?))
}

async fn discover_movie(
    State(state): State<AppState>,
    Query(q): Query<DiscoverParams>,
) -> JsonResult {
    let params = q.to_upstream(DiscoverKind::Movie);
    Ok(Json(state.tmdb.get("/discover/movie", &params).await?))
}

async fn discover_tv(State(state): State<AppState>, Query(q): Query<DiscoverParams>) -> JsonResult {
    let params = q.to_upstream(DiscoverKind::Tv);
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
        let p = DiscoverParams::default().to_upstream(DiscoverKind::Movie);
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
        let movie = q.to_upstream(DiscoverKind::Movie);
        assert_eq!(get(&movie, "with_genres"), Some("28"));
        assert_eq!(get(&movie, "primary_release_year"), Some("2001"));
        assert_eq!(get(&movie, "vote_average.gte"), Some("6.5"));
        assert_eq!(get(&movie, "vote_average.lte"), None);
        let tv = q.to_upstream(DiscoverKind::Tv);
        assert_eq!(get(&tv, "first_air_date_year"), Some("2001"));
    }
}
