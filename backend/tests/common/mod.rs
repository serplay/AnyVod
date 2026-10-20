#![allow(dead_code)]

use anyvod_backend::{AppState, Config, router};
use axum::{
    Router,
    body::Body,
    http::{HeaderMap, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;
use wiremock::MockServer;

pub const API_KEY: &str = "test-key";

pub struct TestApp {
    pub app: Router,
    pub tmdb: MockServer,
    pub vidsrc: MockServer,
}

pub struct TestResponse {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Value,
}

/// Builds the real router against the given upstream base URLs.
pub fn app_with(tmdb_base_url: &str, vidsrc_base_url: &str) -> Router {
    let config = Config::from_lookup(|k| match k {
        "TMDB_API_KEY" => Some(API_KEY.into()),
        "TMDB_BASE_URL" => Some(tmdb_base_url.into()),
        "VIDSRC_BASE_URL" => Some(vidsrc_base_url.into()),
        "ENVIRONMENT" => Some("production".into()),
        "FRONTEND_ORIGIN" => Some("https://frontend.example".into()),
        _ => None,
    })
    .expect("config");
    router(AppState::new(config).expect("state"))
}

pub async fn request(app: &Router, req: Request<Body>) -> TestResponse {
    let res = app.clone().oneshot(req).await.expect("infallible");
    let status = res.status();
    let headers = res.headers().clone();
    let bytes = res.into_body().collect().await.expect("body").to_bytes();
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };
    TestResponse {
        status,
        headers,
        body,
    }
}

pub async fn send(app: &Router, uri: &str) -> TestResponse {
    request(app, Request::get(uri).body(Body::empty()).unwrap()).await
}

impl TestApp {
    pub async fn new() -> Self {
        let tmdb = MockServer::start().await;
        let vidsrc = MockServer::start().await;
        let app = app_with(&format!("{}/3", tmdb.uri()), &vidsrc.uri());
        Self { app, tmdb, vidsrc }
    }

    pub async fn request(&self, req: Request<Body>) -> TestResponse {
        request(&self.app, req).await
    }

    pub async fn get(&self, uri: &str) -> TestResponse {
        send(&self.app, uri).await
    }
}
