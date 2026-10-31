//! AnyVod API: a small TMDB / vidsrc proxy.

pub mod config;
pub mod cors;
pub mod error;
pub mod extract;
pub mod ratelimit;
pub mod state;
pub mod tmdb;
pub mod vidsrc;

use std::time::Duration;

use axum::{
    Json, Router,
    http::{HeaderValue, Method, StatusCode, header},
    middleware::{from_fn_with_state, map_response},
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::json;
use tower_http::{compression::CompressionLayer, timeout::TimeoutLayer, trace::TraceLayer};

pub use config::Config;
pub use state::AppState;

/// Overall per-request budget; upstream calls have their own shorter timeouts.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
pub const CACHE_CONTROL_VALUE: &str = "public, max-age=300";

/// Builds the full application router.
pub fn router(state: AppState) -> Router {
    let cors = cors::CorsConfig::from_config(&state.config).layer();
    let rate_limit = state.config.rate_limit;

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .nest(
            "/tmdb",
            tmdb::routes::router().layer(map_response(cache_control)),
        )
        .nest(
            "/vidsrc",
            vidsrc::router().layer(map_response(cache_control)),
        )
        .fallback(not_found)
        .with_state(state);
    // Innermost, so a 429 still gets compression and CORS headers the browser can read.
    let app = match rate_limit {
        Some(limit) => app.layer(from_fn_with_state(
            ratelimit::RateLimiter::new(limit),
            ratelimit::limit,
        )),
        None => app,
    };
    // Innermost first: timeout, JSON-ify its empty 504, compress, CORS, trace.
    app.layer(TimeoutLayer::with_status_code(
        StatusCode::GATEWAY_TIMEOUT,
        REQUEST_TIMEOUT,
    ))
    .layer(map_response(timeout_body))
    .layer(CompressionLayer::new())
    .layer(cors)
    .layer(TraceLayer::new_for_http())
}

async fn root() -> Json<serde_json::Value> {
    Json(json!({ "message": "Welcome to the AnyVod API" }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(json!({ "detail": "Not Found" })),
    )
        .into_response()
}

/// Adds `Cache-Control: public, max-age=300` to successful GET/HEAD responses.
async fn cache_control(method: Method, mut res: Response) -> Response {
    if (method == Method::GET || method == Method::HEAD) && res.status().is_success() {
        res.headers_mut()
            .entry(header::CACHE_CONTROL)
            .or_insert(HeaderValue::from_static(CACHE_CONTROL_VALUE));
    }
    res
}

/// `TimeoutLayer` produces an empty 504; give it the standard `{"detail"}` body.
async fn timeout_body(res: Response) -> Response {
    if res.status() == StatusCode::GATEWAY_TIMEOUT
        && !res.headers().contains_key(header::CONTENT_TYPE)
    {
        return error::AppError::Timeout.into_response();
    }
    res
}
