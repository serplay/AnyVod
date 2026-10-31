//! `/tmdb/search`: TMDB search with local filtering and sorting of the current page.

use std::cmp::Ordering;

use serde::Deserialize;
use serde_json::{Map, Value};

use crate::{
    error::{AppError, AppResult},
    extract::{MAX_PAGE, checked_page, checked_rating, opt_enum, opt_parse},
};

use super::client::TmdbClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortBy {
    #[default]
    Relevance,
    TitleAsc,
    TitleDesc,
    RatingDesc,
    RatingAsc,
    DateDesc,
    DateAsc,
    PopularityDesc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchType {
    Movie,
    Tv,
    Person,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExternalIdSource {
    Imdb,
    Tvdb,
    Fb,
    Ig,
    X,
    Wd,
    Yt,
    Tt,
    /// Accepted by the parser only so it can be rejected with a clear message.
    Tmdb,
}

impl ExternalIdSource {
    /// TMDB `/find` `external_source` value, or `None` for `tmdb` (not a TMDB find source).
    pub fn external_source(self) -> Option<&'static str> {
        Some(match self {
            ExternalIdSource::Imdb => "imdb_id",
            ExternalIdSource::Tvdb => "tvdb_id",
            ExternalIdSource::Fb => "facebook_id",
            ExternalIdSource::Ig => "instagram_id",
            ExternalIdSource::X => "twitter_id",
            ExternalIdSource::Wd => "wikidata_id",
            ExternalIdSource::Yt => "youtube_id",
            ExternalIdSource::Tt => "tiktok_id",
            ExternalIdSource::Tmdb => return None,
        })
    }
}

/// Longest accepted `query`, in characters. TMDB titles are far shorter than this.
pub const MAX_QUERY_CHARS: usize = 200;

/// When a filter runs locally, one page of our results is built from this many TMDB pages,
/// so a filter like "rated 8+" leaves a usefully full page instead of two or three items.
pub const SCAN_PAGES: u32 = 3;

fn default_page() -> u32 {
    1
}

#[derive(Debug, Clone, Deserialize)]
pub struct SearchParams {
    pub query: String,
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(rename = "type", default, deserialize_with = "opt_enum")]
    pub kind: Option<SearchType>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub year: Option<u32>,
    #[serde(default, deserialize_with = "opt_enum")]
    pub sort_by: Option<SortBy>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub min_rating: Option<f64>,
    #[serde(default, deserialize_with = "opt_parse")]
    pub genre: Option<u64>,
    #[serde(default)]
    pub genres: Option<String>,
    #[serde(default, deserialize_with = "opt_enum")]
    pub exid: Option<ExternalIdSource>,
}

/// Parses a comma-separated list of genre ids (empty segments ignored).
pub fn parse_genre_list(raw: &str) -> Result<Vec<u64>, AppError> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.parse::<u64>()
                .map_err(|_| AppError::BadRequest(format!("invalid genre id in `genres`: {s:?}")))
        })
        .collect()
}

/// Merges `genre` and `genres` into one de-duplicated list of required genre ids.
pub fn merged_genres(genre: Option<u64>, genres: Option<&str>) -> AppResult<Vec<u64>> {
    let mut all = match genres {
        Some(raw) => parse_genre_list(raw)?,
        None => Vec::new(),
    };
    if let Some(g) = genre {
        all.push(g);
    }
    all.sort_unstable();
    all.dedup();
    Ok(all)
}

fn non_empty_str<'a>(item: &'a Value, key: &str) -> Option<&'a str> {
    item.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
}

fn title_key(item: &Value) -> String {
    non_empty_str(item, "title")
        .or_else(|| non_empty_str(item, "name"))
        .unwrap_or("")
        .to_lowercase()
}

fn date_key(item: &Value) -> &str {
    non_empty_str(item, "release_date")
        .or_else(|| non_empty_str(item, "first_air_date"))
        .unwrap_or("")
}

fn num_key(item: &Value, key: &str) -> f64 {
    item.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}

/// Sorts results in place (stable, like Python's `sorted`). `Relevance` keeps upstream order.
pub fn sort_results(results: &mut [Value], sort_by: SortBy) {
    let desc = |o: Ordering| o.reverse();
    match sort_by {
        SortBy::Relevance => {}
        SortBy::TitleAsc => results.sort_by_cached_key(title_key),
        SortBy::TitleDesc => results.sort_by(|a, b| desc(title_key(a).cmp(&title_key(b)))),
        SortBy::RatingDesc => results.sort_by(|a, b| {
            desc(num_key(a, "vote_average").total_cmp(&num_key(b, "vote_average")))
        }),
        SortBy::RatingAsc => results
            .sort_by(|a, b| num_key(a, "vote_average").total_cmp(&num_key(b, "vote_average"))),
        SortBy::DateDesc => results.sort_by(|a, b| desc(date_key(a).cmp(date_key(b)))),
        SortBy::DateAsc => results.sort_by(|a, b| date_key(a).cmp(date_key(b))),
        SortBy::PopularityDesc => results
            .sort_by(|a, b| desc(num_key(a, "popularity").total_cmp(&num_key(b, "popularity")))),
    }
}

/// Keeps items with `vote_average >= min_rating`. `None` or `0` disables the filter.
pub fn filter_by_rating(results: Vec<Value>, min_rating: Option<f64>) -> Vec<Value> {
    match min_rating {
        Some(min) if min != 0.0 => results
            .into_iter()
            .filter(|r| num_key(r, "vote_average") >= min)
            .collect(),
        _ => results,
    }
}

/// Keeps items whose `genre_ids` contain **all** of `required`. Empty `required` keeps everything.
pub fn filter_by_genres(results: Vec<Value>, required: &[u64]) -> Vec<Value> {
    if required.is_empty() {
        return results;
    }
    results
        .into_iter()
        .filter(|r| {
            let ids: Vec<u64> = r
                .get("genre_ids")
                .and_then(Value::as_array)
                .map(|a| a.iter().filter_map(Value::as_u64).collect())
                .unwrap_or_default();
            required.iter().all(|g| ids.contains(g))
        })
        .collect()
}

/// Keeps items whose date (`date_field`, or release/first-air date when `None`) starts with `year`.
pub fn filter_by_year(
    results: Vec<Value>,
    year: Option<u32>,
    date_field: Option<&str>,
) -> Vec<Value> {
    let Some(year) = year else {
        return results;
    };
    let prefix = year.to_string();
    results
        .into_iter()
        .filter(|r| {
            let date = match date_field {
                Some(field) => non_empty_str(r, field).unwrap_or(""),
                None => date_key(r),
            };
            date.starts_with(&prefix)
        })
        .collect()
}

/// Runs a search against TMDB and post-processes the current page.
pub async fn search(client: &TmdbClient, p: SearchParams) -> AppResult<Value> {
    if let Some(exid) = p.exid {
        let source = exid.external_source().ok_or_else(|| {
            AppError::BadRequest("exid `tmdb` is not supported; use the TMDB detail routes".into())
        })?;
        let id = p.query.trim();
        if id.is_empty() || id.len() > 100 {
            return Err(AppError::BadRequest(
                "query must be an external id of at most 100 characters".into(),
            ));
        }
        let path = format!("/find/{}", urlencoding::encode(id));
        let found = client
            .get(&path, &[("external_source", source.to_string())])
            .await?;
        return Ok((*found).clone());
    }

    let query = p.query.trim();
    if query.is_empty() {
        return Err(AppError::BadRequest("query must not be empty".into()));
    }
    if query.chars().count() > MAX_QUERY_CHARS {
        return Err(AppError::BadRequest(format!(
            "query must be at most {MAX_QUERY_CHARS} characters"
        )));
    }
    checked_rating("min_rating", p.min_rating)?;
    let genres = merged_genres(p.genre, p.genres.as_deref())?;
    let sort_by = p.sort_by.unwrap_or_default();

    let mut params = vec![("query", query.to_string())];
    let path = match p.kind {
        Some(SearchType::Person) => "/search/person",
        Some(SearchType::Movie) => {
            if let Some(year) = p.year {
                params.push(("year", year.to_string()));
            }
            "/search/movie"
        }
        Some(SearchType::Tv) => "/search/tv",
        None => "/search/multi",
    };

    // Filters TMDB can't apply for us run here, on the fetched items.
    let local_year = match p.kind {
        Some(SearchType::Movie) | Some(SearchType::Person) => None, // sent upstream / n.a.
        _ => p.year,
    };
    let filters_locally = p.kind != Some(SearchType::Person)
        && (local_year.is_some() || p.min_rating.is_some_and(|m| m != 0.0) || !genres.is_empty());
    let scan = if filters_locally { SCAN_PAGES } else { 1 };
    let page = checked_page(Some(p.page), MAX_PAGE / scan)?;

    // Our page N covers TMDB pages (N-1)*scan+1 ..= N*scan, fetched concurrently.
    let first_upstream = (page - 1) * scan + 1;
    let fetches = (first_upstream..first_upstream + scan).map(|n| {
        let mut params = params.clone();
        params.push(("page", n.to_string()));
        async move { client.get(path, &params).await }
    });
    let pages = futures_util::future::try_join_all(fetches).await?;

    let mut body: Map<String, Value> = match pages.first().map(|v| &**v) {
        Some(Value::Object(map)) => map.clone(),
        _ => Map::new(),
    };
    let mut seen = std::collections::HashSet::new();
    let mut results: Vec<Value> = pages
        .iter()
        .filter_map(|v| v.get("results").and_then(Value::as_array))
        .flatten()
        // Results can shift between TMDB pages; never show the same title twice.
        .filter(|item| {
            let key = (
                item.get("media_type")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                item.get("id").and_then(Value::as_u64),
            );
            key.1.is_none() || seen.insert(key)
        })
        .cloned()
        .collect();
    let scanned = results.len();

    if filters_locally {
        results = filter_by_year(
            results,
            local_year,
            (p.kind == Some(SearchType::Tv)).then_some("first_air_date"),
        );
        results = filter_by_rating(results, p.min_rating);
        results = filter_by_genres(results, &genres);
        // How many items the filters looked at, so the UI can say "4 of 60 match".
        body.insert("filtered_from".into(), Value::from(scanned));
    }
    sort_results(&mut results, sort_by);

    body.insert("results".into(), Value::Array(results));
    body.insert("page".into(), Value::from(page));
    let upstream_pages = body
        .get("total_pages")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(u64::from(MAX_PAGE));
    body.insert(
        "total_pages".into(),
        Value::from(upstream_pages.div_ceil(u64::from(scan))),
    );
    // total_results stays TMDB's count before local filtering.
    body.entry("total_results")
        .or_insert_with(|| Value::from(0));
    Ok(Value::Object(body))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ids(v: &[Value]) -> Vec<u64> {
        v.iter().map(|x| x["id"].as_u64().unwrap()).collect()
    }

    fn sample() -> Vec<Value> {
        vec![
            json!({"id": 1, "title": "beta", "vote_average": 7.0, "release_date": "2010-01-01", "popularity": 5.0, "genre_ids": [28, 12]}),
            json!({"id": 2, "name": "Alpha", "vote_average": 9.0, "first_air_date": "2020-05-05", "popularity": 50.0, "genre_ids": [18]}),
            json!({"id": 3, "title": "", "name": "gamma", "release_date": "", "first_air_date": "1999-12-31", "genre_ids": [28]}),
            json!({"id": 4, "title": "Delta", "vote_average": 7.0, "release_date": "2010-06-01", "popularity": 1.0}),
        ]
    }

    #[test]
    fn sort_relevance_keeps_order() {
        let mut v = sample();
        sort_results(&mut v, SortBy::Relevance);
        assert_eq!(ids(&v), vec![1, 2, 3, 4]);
    }

    #[test]
    fn sort_title() {
        let mut v = sample();
        sort_results(&mut v, SortBy::TitleAsc);
        assert_eq!(ids(&v), vec![2, 1, 4, 3]);
        sort_results(&mut v, SortBy::TitleDesc);
        assert_eq!(ids(&v), vec![3, 4, 1, 2]);
    }

    #[test]
    fn sort_rating_is_stable_and_missing_is_zero() {
        let mut v = sample();
        sort_results(&mut v, SortBy::RatingDesc);
        assert_eq!(ids(&v), vec![2, 1, 4, 3]);
        let mut v = sample();
        sort_results(&mut v, SortBy::RatingAsc);
        assert_eq!(ids(&v), vec![3, 1, 4, 2]);
    }

    #[test]
    fn sort_date_falls_back_to_first_air_date() {
        let mut v = sample();
        sort_results(&mut v, SortBy::DateDesc);
        assert_eq!(ids(&v), vec![2, 4, 1, 3]);
        sort_results(&mut v, SortBy::DateAsc);
        assert_eq!(ids(&v), vec![3, 1, 4, 2]);
    }

    #[test]
    fn sort_popularity() {
        let mut v = sample();
        sort_results(&mut v, SortBy::PopularityDesc);
        assert_eq!(ids(&v), vec![2, 1, 4, 3]);
    }

    #[test]
    fn rating_filter() {
        assert_eq!(ids(&filter_by_rating(sample(), Some(7.5))), vec![2]);
        assert_eq!(ids(&filter_by_rating(sample(), Some(7.0))), vec![1, 2, 4]);
        assert_eq!(
            ids(&filter_by_rating(sample(), Some(0.0))),
            vec![1, 2, 3, 4]
        );
        assert_eq!(ids(&filter_by_rating(sample(), None)), vec![1, 2, 3, 4]);
    }

    #[test]
    fn genre_filter_requires_all() {
        assert_eq!(ids(&filter_by_genres(sample(), &[28])), vec![1, 3]);
        assert_eq!(ids(&filter_by_genres(sample(), &[28, 12])), vec![1]);
        assert_eq!(ids(&filter_by_genres(sample(), &[])), vec![1, 2, 3, 4]);
    }

    #[test]
    fn year_filter() {
        assert_eq!(ids(&filter_by_year(sample(), Some(2010), None)), vec![1, 4]);
        assert_eq!(ids(&filter_by_year(sample(), Some(1999), None)), vec![3]);
        assert_eq!(
            ids(&filter_by_year(
                sample(),
                Some(2020),
                Some("first_air_date")
            )),
            vec![2]
        );
        assert_eq!(ids(&filter_by_year(sample(), None, None)), vec![1, 2, 3, 4]);
    }

    #[test]
    fn genres_merge_and_parse() {
        assert_eq!(
            merged_genres(Some(28), Some("12, 28,,18")).unwrap(),
            vec![12, 18, 28]
        );
        assert_eq!(merged_genres(None, None).unwrap(), Vec::<u64>::new());
        assert!(merged_genres(None, Some("12,abc")).is_err());
    }

    #[test]
    fn exid_mapping() {
        let cases = [
            ("imdb", Some("imdb_id")),
            ("tvdb", Some("tvdb_id")),
            ("fb", Some("facebook_id")),
            ("ig", Some("instagram_id")),
            ("x", Some("twitter_id")),
            ("wd", Some("wikidata_id")),
            ("yt", Some("youtube_id")),
            ("tt", Some("tiktok_id")),
            ("tmdb", None),
        ];
        for (raw, expected) in cases {
            let src: ExternalIdSource = serde_json::from_value(json!(raw)).unwrap();
            assert_eq!(src.external_source(), expected, "{raw}");
        }
        assert!(serde_json::from_value::<ExternalIdSource>(json!("nope")).is_err());
    }

    #[test]
    fn sort_by_parsing() {
        let s: SortBy = serde_json::from_value(json!("popularity_desc")).unwrap();
        assert_eq!(s, SortBy::PopularityDesc);
        assert_eq!(SortBy::default(), SortBy::Relevance);
        assert!(serde_json::from_value::<SortBy>(json!("popularity.desc")).is_err());
    }
}
