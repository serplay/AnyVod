//! Thin caching client for the TMDB v3 API.

use std::{sync::Arc, time::Duration};

use moka::future::Cache;
use serde_json::Value;

use crate::error::{AppError, AppResult};

pub const TMDB_TIMEOUT: Duration = Duration::from_secs(10);
pub const DEFAULT_TTL: Duration = Duration::from_secs(10 * 60);
pub const LONG_TTL: Duration = Duration::from_secs(24 * 60 * 60);
/// Cache budgets in bytes of upstream JSON. A parsed `serde_json::Value` takes roughly 2-4x
/// its JSON size, so 40 MB of JSON stays well inside a 512 MB instance. Detail responses
/// (credits + images + videos) can be 50-200 KB each, which is why the budget is by size.
pub const CACHE_BYTES: u64 = 40 * 1024 * 1024;
pub const LONG_CACHE_BYTES: u64 = 2 * 1024 * 1024;

/// A cached upstream body plus its JSON size, used as the cache weight.
#[derive(Clone)]
struct Cached {
    value: Arc<Value>,
    weight: u32,
}

fn sized_cache(max_bytes: u64, ttl: Duration) -> Cache<String, Cached> {
    Cache::builder()
        .weigher(|key: &String, v: &Cached| {
            v.weight
                .saturating_add(u32::try_from(key.len()).unwrap_or(u32::MAX))
        })
        .max_capacity(max_bytes)
        .time_to_live(ttl)
        .build()
}

/// How long a successful response may be served from cache.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CacheTtl {
    /// ~10 minutes; used for lists, details, search.
    Default,
    /// 24 hours; used for rarely changing data such as genre lists.
    Long,
}

#[derive(Clone)]
pub struct TmdbClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
    cache: Cache<String, Cached>,
    long_cache: Cache<String, Cached>,
}

impl TmdbClient {
    pub fn new(
        http: reqwest::Client,
        base_url: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        Self {
            http,
            base_url: base_url.into().trim_end_matches('/').to_string(),
            api_key: api_key.into(),
            cache: sized_cache(CACHE_BYTES, DEFAULT_TTL),
            long_cache: sized_cache(LONG_CACHE_BYTES, LONG_TTL),
        }
    }

    /// GET `path` (already URL-safe, starting with `/`) with the default TTL.
    pub async fn get(&self, path: &str, params: &[(&str, String)]) -> AppResult<Arc<Value>> {
        self.get_with_ttl(path, params, CacheTtl::Default).await
    }

    /// GET `path` with the given cache TTL. Only successful responses are cached, and
    /// concurrent identical requests are coalesced into a single upstream call.
    pub async fn get_with_ttl(
        &self,
        path: &str,
        params: &[(&str, String)],
        ttl: CacheTtl,
    ) -> AppResult<Arc<Value>> {
        let key = cache_key(path, params);
        let cache = match ttl {
            CacheTtl::Default => &self.cache,
            CacheTtl::Long => &self.long_cache,
        };
        cache
            .try_get_with(key, self.fetch(path, params))
            .await
            .map(|c| c.value)
            .map_err(|e| (*e).clone())
    }

    async fn fetch(&self, path: &str, params: &[(&str, String)]) -> AppResult<Cached> {
        let url = format!("{}{}", self.base_url, path);
        tracing::debug!(%url, ?params, "tmdb request");
        let resp = self
            .http
            .get(&url)
            .query(params)
            .query(&[("api_key", self.api_key.as_str())])
            .timeout(TMDB_TIMEOUT)
            .send()
            .await
            .map_err(|e| AppError::from_transport(&e.without_url()))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::from_upstream("TMDB", status, &body));
        }
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| AppError::from_transport(&e.without_url()))?;
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|e| AppError::BadGateway(format!("invalid upstream response: {e}")))?;
        Ok(Cached {
            value: Arc::new(value),
            weight: u32::try_from(bytes.len()).unwrap_or(u32::MAX),
        })
    }
}

/// Cache key: path plus params sorted by key then value, so param order never matters.
pub fn cache_key(path: &str, params: &[(&str, String)]) -> String {
    let mut sorted: Vec<_> = params.iter().collect();
    sorted.sort();
    let qs: Vec<String> = sorted.iter().map(|(k, v)| format!("{k}={v}")).collect();
    format!("{path}?{}", qs.join("&"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_key_is_order_independent() {
        let a = cache_key("/x", &[("b", "2".into()), ("a", "1".into())]);
        let b = cache_key("/x", &[("a", "1".into()), ("b", "2".into())]);
        assert_eq!(a, b);
        assert_eq!(a, "/x?a=1&b=2");
        assert_ne!(a, cache_key("/y", &[("a", "1".into()), ("b", "2".into())]));
    }
}
