mod common;

use axum::http::{StatusCode, header};
use common::TestApp;
use serde_json::json;
use wiremock::{
    Mock, ResponseTemplate,
    matchers::{method, path},
};

#[tokio::test]
async fn embed_movie_url() {
    let t = TestApp::new().await;
    let base = t.vidsrc.uri();
    let res = t.get("/vidsrc/embed/movie?tmdb=550").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(
        res.body,
        json!({"embed_url": format!("{base}/embed/movie/550")})
    );
    assert_eq!(res.headers[header::CACHE_CONTROL], "public, max-age=300");

    let res = t
        .get("/vidsrc/embed/movie?imdb=tt0137523&ds_lang=de&autoplay=1&sub_url=https%3A%2F%2Fs.example%2Fx.vtt")
        .await;
    assert_eq!(
        res.body["embed_url"],
        format!(
            "{base}/embed/movie/tt0137523?ds_lang=de&sub_url=https%3A%2F%2Fs.example%2Fx.vtt&autoplay=1"
        )
    );

    let res = t.get("/vidsrc/embed/movie").await;
    assert_eq!(res.body["embed_url"], format!("{base}/embed/movie"));
}

#[tokio::test]
async fn embed_tv_url() {
    let t = TestApp::new().await;
    let base = t.vidsrc.uri();
    let res = t
        .get("/vidsrc/embed/tv?tmdb=1399&season=1&episode=2&autonext=1")
        .await;
    assert_eq!(
        res.body["embed_url"],
        format!("{base}/embed/tv/1399/1/2?autonext=1")
    );

    let res = t.get("/vidsrc/embed/tv?tmdb=1399&season=1").await;
    assert_eq!(res.body["embed_url"], format!("{base}/embed/tv/1399"));

    let res = t.get("/vidsrc/embed/tv?tmdb=1399&season=x").await;
    assert_eq!(res.status, StatusCode::BAD_REQUEST);
    assert!(res.body["detail"].is_string());
}

#[tokio::test]
async fn latest_lists_are_proxied_and_cached() {
    let t = TestApp::new().await;
    let movies = json!({"result": [{"tmdb_id": "1"}], "pages": 10});
    Mock::given(method("GET"))
        .and(path("/movies/latest/page-2.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&movies))
        .expect(1)
        .mount(&t.vidsrc)
        .await;
    Mock::given(method("GET"))
        .and(path("/tvshows/latest/page-1.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"result": []})))
        .expect(1)
        .mount(&t.vidsrc)
        .await;

    for _ in 0..2 {
        let res = t.get("/vidsrc/latest/movies?page=2").await;
        assert_eq!(res.status, StatusCode::OK);
        assert_eq!(res.body, movies);
    }
    assert_eq!(
        t.get("/vidsrc/latest/tvshows").await.body,
        json!({"result": []})
    );
}

#[tokio::test]
async fn latest_upstream_error_passthrough() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/movies/latest/page-99.json"))
        .respond_with(ResponseTemplate::new(404).set_body_string("nope"))
        .mount(&t.vidsrc)
        .await;
    let res = t.get("/vidsrc/latest/movies?page=99").await;
    assert_eq!(res.status, StatusCode::NOT_FOUND);
    assert_eq!(res.body, json!({"detail": "nope"}));
}

#[tokio::test]
async fn movie_availability_positive_uses_info_endpoint_and_caches() {
    let t = TestApp::new().await;
    let base = t.vidsrc.uri();
    Mock::given(method("GET"))
        .and(path("/info/movie/550.json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"status_code": 200})))
        .expect(1) // second call is served from the availability cache
        .mount(&t.vidsrc)
        .await;

    for _ in 0..2 {
        let res = t.get("/vidsrc/movie/availability/550").await;
        assert_eq!(res.status, StatusCode::OK);
        assert_eq!(
            res.body,
            json!({
                "available": true,
                "embed_url": format!("{base}/embed/movie/550"),
                "tmdb_id": 550,
                "type": "movie"
            })
        );
    }
}

#[tokio::test]
async fn tv_availability_negative_cases() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/info/tv/1399/1/2.json"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&t.vidsrc)
        .await;
    Mock::given(method("GET"))
        .and(path("/info/tv/1400.json"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&t.vidsrc)
        .await;
    Mock::given(method("GET"))
        .and(path("/info/tv/1401.json"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&t.vidsrc)
        .await;

    let res = t
        .get("/vidsrc/tv/availability/1399?season=1&episode=2")
        .await;
    assert_eq!(
        res.body,
        json!({"available": false, "reason": "not found", "tmdb_id": 1399, "type": "tv", "season": 1, "episode": 2})
    );
    let res = t.get("/vidsrc/tv/availability/1400").await;
    assert_eq!(
        res.body,
        json!({"available": false, "reason": "HTTP 503", "tmdb_id": 1400, "type": "tv"})
    );
    let res = t.get("/vidsrc/tv/availability/1401").await;
    assert_eq!(res.body["available"], true);
}

#[tokio::test]
async fn availability_transport_error_is_reported_not_raised() {
    let app = common::app_with("http://127.0.0.1:1/3", "http://127.0.0.1:1");
    let res = common::send(&app, "/vidsrc/movie/availability/1").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body["available"], false);
    assert!(res.body["reason"].is_string());
    assert_eq!(res.body["tmdb_id"], 1);
}
