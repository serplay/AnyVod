mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use common::TestApp;
use serde_json::json;
use wiremock::{
    Mock, ResponseTemplate,
    matchers::{method, path},
};

#[tokio::test]
async fn root_and_health() {
    let t = TestApp::new().await;
    let res = t.get("/").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body, json!({"message": "Welcome to the AnyVod API"}));

    let res = t.get("/health").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body, json!({"status": "ok"}));
    assert!(res.headers.get(header::CACHE_CONTROL).is_none());
}

#[tokio::test]
async fn unknown_routes_are_json_404() {
    let t = TestApp::new().await;
    for uri in ["/nope", "/tmdb/nope", "/tmdb/image_base", "/vidsrc/nope"] {
        let res = t.get(uri).await;
        assert_eq!(res.status, StatusCode::NOT_FOUND, "{uri}");
        assert_eq!(res.body, json!({"detail": "Not Found"}), "{uri}");
    }
}

fn preflight(origin: &str) -> Request<Body> {
    Request::builder()
        .method(Method::OPTIONS)
        .uri("/tmdb/popular")
        .header(header::ORIGIN, origin)
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
        .body(Body::empty())
        .unwrap()
}

#[tokio::test]
async fn cors_preflight() {
    let t = TestApp::new().await;
    for origin in [
        "https://frontend.example",
        "https://vod.losingsanity.com",
        "https://vod.losingsanity.xyz",
        "https://any-vod-git-feature-infinitys-projects-38b16f39.vercel.app",
    ] {
        let res = t.request(preflight(origin)).await;
        assert!(res.status.is_success(), "{origin}");
        assert_eq!(res.headers[header::ACCESS_CONTROL_ALLOW_ORIGIN], origin);
        assert!(
            res.headers
                .get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS)
                .is_none()
        );
    }
    // ENVIRONMENT=production in tests, so localhost is not allowed.
    for origin in [
        "https://evil.example",
        "http://localhost:5173",
        "https://someone-else.vercel.app",
    ] {
        let res = t.request(preflight(origin)).await;
        assert!(
            res.headers
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .is_none(),
            "{origin}"
        );
    }
}

#[tokio::test]
async fn cors_headers_on_simple_get() {
    let t = TestApp::new().await;
    let res = t
        .request(
            Request::get("/health")
                .header(header::ORIGIN, "https://vod.losingsanity.com")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
    assert_eq!(
        res.headers[header::ACCESS_CONTROL_ALLOW_ORIGIN],
        "https://vod.losingsanity.com"
    );
}

#[tokio::test]
async fn responses_are_gzip_compressed_when_accepted() {
    let t = TestApp::new().await;
    let big: Vec<_> = (0..200).map(|i| json!({"id": i, "title": "x"})).collect();
    Mock::given(method("GET"))
        .and(path("/3/trending/movie/week"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"results": big})))
        .mount(&t.tmdb)
        .await;
    let res = t
        .request(
            Request::get("/tmdb/trending/movie/week")
                .header(header::ACCEPT_ENCODING, "gzip")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.headers[header::CONTENT_ENCODING], "gzip");
}
