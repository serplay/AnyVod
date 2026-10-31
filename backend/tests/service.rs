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
        "https://any-vod.vercel.app",
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

#[tokio::test]
async fn clients_over_the_rate_limit_get_429() {
    use anyvod_backend::{AppState, Config, router};
    let config = Config::from_lookup(|k| match k {
        "TMDB_API_KEY" => Some("k".into()),
        "TMDB_BASE_URL" => Some("http://127.0.0.1:1/3".into()),
        "RATE_LIMIT_PER_SEC" => Some("0.001".into()),
        "RATE_LIMIT_BURST" => Some("2".into()),
        _ => None,
    })
    .unwrap();
    let app = router(AppState::new(config).unwrap());
    let from = |ip: &'static str| {
        Request::get("/")
            .header("cf-connecting-ip", ip)
            .header(header::ORIGIN, "https://vod.losingsanity.com")
            .body(Body::empty())
            .unwrap()
    };
    for _ in 0..2 {
        assert_eq!(
            common::request(&app, from("1.1.1.1")).await.status,
            StatusCode::OK
        );
    }
    let res = common::request(&app, from("1.1.1.1")).await;
    assert_eq!(res.status, StatusCode::TOO_MANY_REQUESTS);
    assert!(res.headers.contains_key(header::RETRY_AFTER));
    assert!(res.body["detail"].is_string());
    // The browser must be able to read the 429.
    assert_eq!(
        res.headers[header::ACCESS_CONTROL_ALLOW_ORIGIN],
        "https://vod.losingsanity.com"
    );
    // Other clients and health checks are unaffected.
    assert_eq!(
        common::request(&app, from("2.2.2.2")).await.status,
        StatusCode::OK
    );
    let health = Request::get("/health")
        .header("cf-connecting-ip", "1.1.1.1")
        .body(Body::empty())
        .unwrap();
    assert_eq!(common::request(&app, health).await.status, StatusCode::OK);
}
