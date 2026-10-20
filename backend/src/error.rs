//! Application error type. Every error renders as `{"detail": string}`.

use axum::{
    Json,
    extract::rejection::{PathRejection, QueryRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, Clone, thiserror::Error)]
pub enum AppError {
    /// Upstream answered with a non-success status; status and body are passed through.
    #[error("upstream returned {status}: {body}")]
    Upstream { status: StatusCode, body: String },
    #[error("{0}")]
    BadRequest(String),
    #[error("upstream request timed out")]
    Timeout,
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
            AppError::BadGateway(_) => StatusCode::BAD_GATEWAY,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn detail(&self) -> String {
        match self {
            AppError::Upstream { body, .. } => body.clone(),
            other => other.to_string(),
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

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        if status.is_server_error() {
            tracing::warn!(%status, error = %self, "request failed");
        }
        (status, Json(json!({ "detail": self.detail() }))).into_response()
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
