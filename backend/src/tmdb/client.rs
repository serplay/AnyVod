//! Thin caching client for the TMDB v3 API.

use std::{sync::Arc, time::Duration};

use moka::future::Cache;
use serde_json::Value;

use crate::error::{AppError, AppResult};

pub const TMDB_TIMEOUT: Duration = Duration::from_secs(10);
pub const DEFAULT_TTL: Duration = Duration::from_secs(10 * 60);
pub const LONG_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_ENTRIES: u64 = 10_000;

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
    cache: Cache<String, Arc<Value>>,
    long_cache: Cache<String, Arc<Value>>,
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
            cache: Cache::builder()
                .max_capacity(MAX_ENTRIES)
                .time_to_live(DEFAULT_TTL)
                .build(),
            long_cache: Cache::builder()
                .max_capacity(1_000)
                .time_to_live(LONG_TTL)
                .build(),
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
            .map_err(|e| (*e).clone())
    }

    async fn fetch(&self, path: &str, params: &[(&str, String)]) -> AppResult<Arc<Value>> {
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
            return Err(AppError::Upstream { status, body });
        }
        let value: Value = resp
            .json()
            .await
            .map_err(|e| AppError::from_transport(&e.without_url()))?;
        Ok(Arc::new(value))
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
