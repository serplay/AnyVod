mod common;

use axum::http::{StatusCode, header};
use common::{API_KEY, TestApp};
use serde_json::{Value, json};
use wiremock::{
    Mock, ResponseTemplate,
    matchers::{method, path, query_param, query_param_is_missing},
};

fn ids(body: &Value) -> Vec<u64> {
    body["results"]
        .as_array()
        .expect("results array")
        .iter()
        .map(|r| r["id"].as_u64().unwrap())
        .collect()
}

#[tokio::test]
async fn trending_is_passed_through() {
    let t = TestApp::new().await;
    let upstream = json!({"page": 1, "results": [{"id": 1, "media_type": "movie"}], "total_pages": 9, "total_results": 170, "extra": {"kept": true}});
    Mock::given(method("GET"))
        .and(path("/3/trending/all/day"))
        .and(query_param("api_key", API_KEY))
        .respond_with(ResponseTemplate::new(200).set_body_json(&upstream))
        .expect(1)
        .mount(&t.tmdb)
        .await;

    let res = t.get("/tmdb/trending/all/day").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body, upstream);
    assert_eq!(res.headers[header::CACHE_CONTROL], "public, max-age=300");
}

#[tokio::test]
async fn trending_rejects_unknown_media_type() {
    let t = TestApp::new().await;
    let res = t.get("/tmdb/trending/cats/day").await;
    assert_eq!(res.status, StatusCode::BAD_REQUEST);
    assert!(res.body["detail"].is_string());
    assert!(res.headers.get(header::CACHE_CONTROL).is_none());
}

#[tokio::test]
async fn detail_routes_append_credits_images_videos() {
    let t = TestApp::new().await;
    for (route, upstream) in [
        ("/tmdb/movie/550", "/3/movie/550"),
        ("/tmdb/tv/1399", "/3/tv/1399"),
    ] {
        Mock::given(method("GET"))
            .and(path(upstream))
            .and(query_param("append_to_response", "credits,images,videos"))
            .and(query_param("api_key", API_KEY))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({"id": 1, "credits": {"cast": []}})),
            )
            .expect(1)
            .mount(&t.tmdb)
            .await;
        let res = t.get(route).await;
        assert_eq!(res.status, StatusCode::OK, "{route}");
        assert_eq!(res.body["credits"]["cast"], json!([]));
    }
}

#[tokio::test]
async fn static_segments_win_over_captures() {
    let t = TestApp::new().await;
    for name in ["popular", "top_rated", "upcoming", "now_playing"] {
        Mock::given(method("GET"))
            .and(path(format!("/3/movie/{name}")))
            .and(query_param_is_missing("append_to_response"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"list": name})))
            .mount(&t.tmdb)
            .await;
    }
    for name in ["popular", "top_rated", "on_the_air"] {
        Mock::given(method("GET"))
            .and(path(format!("/3/tv/{name}")))
            .and(query_param_is_missing("append_to_response"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({"list": format!("tv-{name}")})),
            )
            .mount(&t.tmdb)
            .await;
    }
    Mock::given(method("GET"))
        .and(path("/3/movie/550"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"id": 550})))
        .mount(&t.tmdb)
        .await;

    for name in ["popular", "top_rated", "upcoming", "now_playing"] {
        let res = t.get(&format!("/tmdb/movie/{name}")).await;
        assert_eq!(res.status, StatusCode::OK, "{name}");
        assert_eq!(res.body, json!({"list": name}));
    }
    for name in ["popular", "top_rated", "on_the_air"] {
        let res = t.get(&format!("/tmdb/tv/{name}")).await;
        assert_eq!(res.body, json!({"list": format!("tv-{name}")}));
    }
    assert_eq!(t.get("/tmdb/movie/550").await.body, json!({"id": 550}));

    let res = t.get("/tmdb/movie/not-a-number").await;
    assert_eq!(res.status, StatusCode::BAD_REQUEST);
    assert!(res.body["detail"].is_string());
}

#[tokio::test]
async fn popular_aliases_forward_page() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/movie/popular"))
        .and(query_param("page", "3"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"page": 3, "results": []})))
        .expect(1) // second call is served from cache: same upstream path + params
        .mount(&t.tmdb)
        .await;
    Mock::given(method("GET"))
        .and(path("/3/movie/popular"))
        .and(query_param("page", "1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"page": 1, "results": []})))
        .expect(1)
        .mount(&t.tmdb)
        .await;

    assert_eq!(t.get("/tmdb/popular?page=3").await.body["page"], 3);
    assert_eq!(t.get("/tmdb/movie/popular?page=3").await.body["page"], 3);
    assert_eq!(t.get("/tmdb/popular").await.body["page"], 1);
    assert_eq!(
        t.get("/tmdb/popular?page=abc").await.status,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn other_passthrough_routes_hit_expected_upstreams() {
    let t = TestApp::new().await;
    let routes = [
        (
            "/tmdb/movie/5/similar?page=2",
            "/3/movie/5/similar",
            Some("2"),
        ),
        ("/tmdb/tv/6/similar", "/3/tv/6/similar", Some("1")),
        ("/tmdb/tv/6/season/2", "/3/tv/6/season/2", None),
        ("/tmdb/person/7", "/3/person/7", None),
        (
            "/tmdb/person/7/combined_credits",
            "/3/person/7/combined_credits",
            None,
        ),
        ("/tmdb/genres/movie", "/3/genre/movie/list", None),
        ("/tmdb/genres/tv", "/3/genre/tv/list", None),
    ];
    for (route, upstream, page) in routes {
        let mut mock = Mock::given(method("GET")).and(path(upstream));
        if let Some(page) = page {
            mock = mock.and(query_param("page", page));
        }
        mock.respond_with(ResponseTemplate::new(200).set_body_json(json!({"upstream": upstream})))
            .expect(1)
            .mount(&t.tmdb)
            .await;
        let res = t.get(route).await;
        assert_eq!(res.status, StatusCode::OK, "{route}");
        assert_eq!(res.body, json!({"upstream": upstream}), "{route}");
    }
}

#[tokio::test]
async fn discover_maps_params() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/discover/movie"))
        .and(query_param("page", "2"))
        .and(query_param("sort_by", "vote_average.desc"))
        .and(query_param("vote_average.gte", "6.5"))
        .and(query_param("primary_release_year", "1999"))
        .and(query_param("with_genres", "28"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": "movie"})))
        .expect(1)
        .mount(&t.tmdb)
        .await;
    Mock::given(method("GET"))
        .and(path("/3/discover/tv"))
        .and(query_param("sort_by", "popularity.desc"))
        .and(query_param("first_air_date_year", "2011"))
        .and(query_param("with_genres", "18,10765"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": "tv"})))
        .expect(1)
        .mount(&t.tmdb)
        .await;

    let res = t
        .get("/tmdb/discover/movie?page=2&sort_by=vote_average.desc&min_rating=6.5&year=1999&genre=28&with_genres=12")
        .await;
    assert_eq!(res.body, json!({"ok": "movie"}));
    let res = t
        .get("/tmdb/discover/tv?year=2011&with_genres=18,10765")
        .await;
    assert_eq!(res.body, json!({"ok": "tv"}));
}

fn search_page() -> Value {
    json!({
        "page": 2,
        "total_pages": 7,
        "total_results": 130,
        "results": [
            {"id": 1, "title": "A", "vote_average": 6.0, "release_date": "2010-01-01", "genre_ids": [28, 12]},
            {"id": 2, "title": "B", "vote_average": 8.0, "release_date": "2010-02-01", "genre_ids": [28, 12, 18]},
            {"id": 3, "title": "C", "vote_average": 9.0, "release_date": "2011-01-01", "genre_ids": [12, 28]},
            {"id": 4, "name": "D", "vote_average": 7.5, "first_air_date": "2010-03-01", "genre_ids": [12, 28]},
            {"id": 5, "name": "Person", "known_for_department": "Acting"}
        ]
    })
}

#[tokio::test]
async fn search_movie_filters_sorts_and_preserves_pagination() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/movie"))
        .and(query_param("query", "fight club"))
        .and(query_param("year", "2010"))
        .respond_with(ResponseTemplate::new(200).set_body_json(search_page()))
        .expect(3)
        .mount(&t.tmdb)
        .await;

    let res = t
        .get("/tmdb/search?query=fight%20club&page=2&type=movie&year=2010&min_rating=7&genre=28&genres=12&sort_by=rating_desc")
        .await;
    assert_eq!(res.status, StatusCode::OK);
    // Filters run locally, so our page 2 is built from TMDB pages 4-6.
    let mut pages: Vec<String> = t
        .tmdb
        .received_requests()
        .await
        .unwrap()
        .iter()
        .filter_map(|r| {
            r.url
                .query_pairs()
                .find(|(k, _)| k == "page")
                .map(|(_, v)| v.into_owned())
        })
        .collect();
    pages.sort();
    assert_eq!(pages, ["4", "5", "6"]);
    // year is sent upstream for movies (no local filter), so id 3 (2011) stays. The mock
    // returns the same items for every page; duplicates are dropped.
    assert_eq!(ids(&res.body), vec![3, 2, 4]);
    assert_eq!(res.body["page"], 2);
    assert_eq!(res.body["total_pages"], 3); // ceil(7 TMDB pages / 3)
    assert_eq!(res.body["total_results"], 130);
    assert_eq!(res.body["filtered_from"], 5);
}

#[tokio::test]
async fn search_without_local_filters_maps_pages_one_to_one() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/movie"))
        .and(query_param("page", "2"))
        .respond_with(ResponseTemplate::new(200).set_body_json(search_page()))
        .expect(1)
        .mount(&t.tmdb)
        .await;
    let res = t
        .get("/tmdb/search?query=x&type=movie&page=2&sort_by=rating_desc")
        .await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body["page"], 2);
    assert_eq!(res.body["total_pages"], 7);
    assert!(res.body.get("filtered_from").is_none());
}

#[tokio::test]
async fn search_multi_filters_year_locally_and_requires_all_genres() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/multi"))
        .and(query_param_is_missing("year"))
        .respond_with(ResponseTemplate::new(200).set_body_json(search_page()))
        .expect(3) // filtered: TMDB pages 1-3; the unfiltered request below reuses page 1
        .mount(&t.tmdb)
        .await;

    let res = t
        .get("/tmdb/search?query=x&year=2010&genres=28,18&sort_by=date_asc")
        .await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(ids(&res.body), vec![2]);

    // Same upstream request again (cached): relevance + no filters keeps upstream order.
    let res = t.get("/tmdb/search?query=x").await;
    assert_eq!(ids(&res.body), vec![1, 2, 3, 4, 5]);
}

#[tokio::test]
async fn search_tv_filters_on_first_air_date() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/tv"))
        .respond_with(ResponseTemplate::new(200).set_body_json(search_page()))
        .mount(&t.tmdb)
        .await;
    let res = t.get("/tmdb/search?query=x&type=tv&year=2010").await;
    assert_eq!(ids(&res.body), vec![4]);
}

#[tokio::test]
async fn search_person_sorts_only() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/person"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "page": 1, "total_pages": 1, "total_results": 2,
            "results": [{"id": 1, "name": "Zed", "popularity": 1.0}, {"id": 2, "name": "Amy", "popularity": 5.0}]
        })))
        .mount(&t.tmdb)
        .await;
    let res = t
        .get("/tmdb/search?query=x&type=person&sort_by=title_asc&min_rating=9&genre=28")
        .await;
    assert_eq!(ids(&res.body), vec![2, 1]);
}

#[tokio::test]
async fn search_never_returns_null_when_results_missing() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/search/multi"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"page": 1})))
        .mount(&t.tmdb)
        .await;
    let res = t.get("/tmdb/search?query=x&sort_by=title_desc").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body["results"], json!([]));
    assert_eq!(res.body["total_pages"], 0);
}

#[tokio::test]
async fn search_exid_uses_find_with_external_source() {
    let t = TestApp::new().await;
    let found = json!({"movie_results": [{"id": 550}], "tv_results": [], "person_results": []});
    Mock::given(method("GET"))
        .and(path("/3/find/tt0137523"))
        .and(query_param("external_source", "imdb_id"))
        .and(query_param("api_key", API_KEY))
        .respond_with(ResponseTemplate::new(200).set_body_json(&found))
        .expect(1)
        .mount(&t.tmdb)
        .await;
    Mock::given(method("GET"))
        .and(path("/3/find/%40someone"))
        .and(query_param("external_source", "tiktok_id"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"person_results": []})))
        .expect(1)
        .mount(&t.tmdb)
        .await;

    let res = t.get("/tmdb/search?query=tt0137523&exid=imdb").await;
    assert_eq!(res.status, StatusCode::OK);
    assert_eq!(res.body, found);
    let res = t.get("/tmdb/search?query=%40someone&exid=tt").await;
    assert_eq!(res.status, StatusCode::OK);
}

#[tokio::test]
async fn search_bad_input_is_400_with_detail() {
    let t = TestApp::new().await;
    for uri in [
        "/tmdb/search?query=x&sort_by=popularity.desc",
        "/tmdb/search?query=x&type=anime",
        "/tmdb/search?query=x&exid=myspace",
        "/tmdb/search?query=123&exid=tmdb",
        "/tmdb/search?query=x&genres=28,abc",
        "/tmdb/search?query=x&min_rating=11",
        "/tmdb/search?query=x&year=abc",
        "/tmdb/search?query=x&page=0",
        "/tmdb/search?query=x&page=501",
        "/tmdb/search?query=x&page=200&min_rating=7", // filtered searches stop at 500 / 3
        "/tmdb/search?query=%20%20",
        "/tmdb/search",
    ] {
        let res = t.get(uri).await;
        assert_eq!(res.status, StatusCode::BAD_REQUEST, "{uri}");
        assert!(res.body["detail"].is_string(), "{uri}: {:?}", res.body);
    }
    // Nothing should have reached TMDB.
    assert!(t.tmdb.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn upstream_errors_pass_status_and_body_through() {
    let t = TestApp::new().await;
    let body = r#"{"success":false,"status_code":34,"status_message":"The resource you requested could not be found."}"#;
    Mock::given(method("GET"))
        .and(path("/3/movie/999999"))
        .respond_with(ResponseTemplate::new(404).set_body_string(body))
        .expect(2) // errors are not cached
        .mount(&t.tmdb)
        .await;

    for _ in 0..2 {
        let res = t.get("/tmdb/movie/999999").await;
        assert_eq!(res.status, StatusCode::NOT_FOUND);
        assert_eq!(
            res.body,
            json!({"detail": "The resource you requested could not be found."})
        );
        assert!(res.headers.get(header::CACHE_CONTROL).is_none());
    }
}

#[tokio::test]
async fn upstream_auth_and_server_errors_are_hidden() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/movie/1"))
        .respond_with(ResponseTemplate::new(401).set_body_string(
            r#"{"status_code":7,"status_message":"Invalid API key: You must be granted a valid key."}"#,
        ))
        .mount(&t.tmdb)
        .await;
    Mock::given(method("GET"))
        .and(path("/3/movie/2"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&t.tmdb)
        .await;
    let res = t.get("/tmdb/movie/1").await;
    assert_eq!(res.status, StatusCode::BAD_GATEWAY);
    assert!(!res.body["detail"].as_str().unwrap().contains("API key"));
    let res = t.get("/tmdb/movie/2").await;
    assert_eq!(res.status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn list_and_discover_reject_bad_input_without_calling_tmdb() {
    let t = TestApp::new().await;
    for uri in [
        "/tmdb/popular?page=0",
        "/tmdb/movie/top_rated?page=501",
        "/tmdb/movie/550/similar?page=9999",
        "/tmdb/discover/movie?sort_by=bogus.desc",
        "/tmdb/discover/tv?sort_by=revenue.desc",
        "/tmdb/discover/movie?with_genres=28;1",
        "/tmdb/discover/movie?min_rating=-2",
    ] {
        let res = t.get(uri).await;
        assert_eq!(res.status, StatusCode::BAD_REQUEST, "{uri}");
        assert!(res.body["detail"].is_string(), "{uri}");
    }
    assert!(t.tmdb.received_requests().await.unwrap().is_empty());
}

#[tokio::test]
async fn slow_changing_routes_get_longer_cache_lifetimes() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .mount(&t.tmdb)
        .await;
    let cases = [
        ("/tmdb/genres/movie", "public, max-age=86400"),
        ("/tmdb/person/287", "public, max-age=3600"),
        ("/tmdb/movie/550", "public, max-age=300"),
    ];
    for (uri, expected) in cases {
        let res = t.get(uri).await;
        assert_eq!(res.headers[header::CACHE_CONTROL], expected, "{uri}");
    }
}

#[tokio::test]
async fn identical_requests_hit_upstream_once() {
    let t = TestApp::new().await;
    Mock::given(method("GET"))
        .and(path("/3/tv/popular"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"page": 1, "results": [{"id": 1}]})),
        )
        .expect(1)
        .mount(&t.tmdb)
        .await;
    let a = t.get("/tmdb/tv/popular?page=1").await;
    let b = t.get("/tmdb/tv/popular").await; // default page=1 → same cache key
    assert_eq!(a.status, StatusCode::OK);
    assert_eq!(a.body, b.body);
}

#[tokio::test]
async fn api_key_is_not_leaked_on_transport_errors() {
    // Nothing listens on port 1, so the connection is refused.
    let app = common::app_with("http://127.0.0.1:1/3", "http://127.0.0.1:1");
    let res = common::send(&app, "/tmdb/movie/1").await;
    assert_eq!(res.status, StatusCode::BAD_GATEWAY);
    let detail = res.body["detail"].as_str().unwrap();
    assert!(!detail.contains(API_KEY), "{detail}");
}
