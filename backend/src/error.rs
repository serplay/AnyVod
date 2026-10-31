//! Application error type. Every error renders as `{"detail": string}`.

use axum::{
    Json,
    extract::rejection::{PathRejection, QueryRejection},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, Clone, thiserror::Error)]
pub enum AppError {
    /// Upstream rejected the request as invalid (e.g. an unknown id): the status is passed
    /// through with upstream's human-readable message. Built by [`AppError::from_upstream`].
    #[error("upstream returned {status}: {message}")]
    Upstream { status: StatusCode, message: String },
    #[error("{0}")]
    BadRequest(String),
    #[error("upstream request timed out")]
    Timeout,
    /// Upstream is rate limiting us; worth retrying shortly.
    #[error("the catalogue service is busy, try again in a moment")]
    UpstreamBusy,
    /// This client sent too many requests. Carries the suggested wait in seconds.
    #[error("too many requests, slow down")]
    TooManyRequests { retry_after_secs: u64 },
    /// Upstream could not be reached or returned an unusable body.
    #[error("{0}")]
    BadGateway(String),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn status(&self) -> StatusCode {
        match self {
            AppError::Upstream { status, .. } => *status,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Timeout => StatusCode::GATEWAY_TIMEOUT,
            AppError::UpstreamBusy => StatusCode::SERVICE_UNAVAILABLE,
            AppError::TooManyRequests { .. } => StatusCode::TOO_MANY_REQUESTS,
            AppError::BadGateway(_) => StatusCode::BAD_GATEWAY,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn detail(&self) -> String {
        match self {
            AppError::Upstream { message, .. } => message.clone(),
            other => other.to_string(),
        }
    }

    /// Maps a non-success upstream response. Client errors about the request itself (404, 422,
    /// ...) keep their status and upstream's message. Anything that is our problem rather than
    /// the caller's (auth failures from a bad API key, rate limiting, upstream 5xx) becomes a
    /// generic 502/503; the raw body is logged, never sent to the browser.
    pub fn from_upstream(service: &str, status: reqwest::StatusCode, body: &str) -> Self {
        let status = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
        match status {
            StatusCode::TOO_MANY_REQUESTS => {
                tracing::warn!(service, "upstream is rate limiting us");
                AppError::UpstreamBusy
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                tracing::error!(service, %status, body, "upstream rejected our credentials");
                AppError::BadGateway(format!("{service} is unavailable"))
            }
            s if s.is_client_error() => AppError::Upstream {
                status: s,
                message: upstream_message(body)
                    .unwrap_or_else(|| s.canonical_reason().unwrap_or("request failed").into()),
            },
            s => {
                tracing::warn!(service, status = %s, body, "upstream error");
                AppError::BadGateway(format!("{service} returned an error"))
            }
        }
    }

    /// Maps a transport-level reqwest error (no HTTP response) to an AppError.
    pub fn from_transport(err: &reqwest::Error) -> Self {
        if err.is_timeout() {
            AppError::Timeout
        } else if err.is_decode() {
            AppError::BadGateway(format!("invalid upstream response: {err}"))
        } else {
            AppError::BadGateway(format!("upstream request failed: {err}"))
        }
    }
}

/// TMDB error bodies look like `{"status_code": 34, "status_message": "..."}`.
fn upstream_message(body: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    v.get("status_message")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        if status.is_server_error() {
            tracing::warn!(%status, error = %self, "request failed");
        }
        let mut res = (status, Json(json!({ "detail": self.detail() }))).into_response();
        if let AppError::TooManyRequests { retry_after_secs } = self {
            res.headers_mut()
                .insert(header::RETRY_AFTER, HeaderValue::from(retry_after_secs));
        }
        res
    }
}

impl From<QueryRejection> for AppError {
    fn from(rejection: QueryRejection) -> Self {
        AppError::BadRequest(rejection.body_text())
    }
}

impl From<PathRejection> for AppError {
    fn from(rejection: PathRejection) -> Self {
        AppError::BadRequest(rejection.body_text())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    fn map(status: u16, body: &str) -> AppError {
        AppError::from_upstream("TMDB", reqwest::StatusCode::from_u16(status).unwrap(), body)
    }

    #[test]
    fn client_errors_keep_status_and_readable_message() {
        let e = map(404, r#"{"status_code":34,"status_message":"Not here."}"#);
        assert_eq!(e.status(), StatusCode::NOT_FOUND);
        assert_eq!(e.detail(), "Not here.");
        let e = map(422, "garbage");
        assert_eq!(e.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(e.detail(), "Unprocessable Entity");
    }

    #[test]
    fn our_problems_become_generic_gateway_errors() {
        let secret = r#"{"status_message":"Invalid API key: You must be granted a valid key."}"#;
        for code in [401, 403, 500, 503] {
            let e = map(code, secret);
            assert_eq!(e.status(), StatusCode::BAD_GATEWAY, "{code}");
            assert!(!e.detail().contains("API key"), "{code}");
        }
        assert_eq!(map(429, "").status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn too_many_requests_sets_retry_after() {
        let res = AppError::TooManyRequests {
            retry_after_secs: 3,
        }
        .into_response();
        assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(res.headers()[header::RETRY_AFTER], "3");
    }
}
