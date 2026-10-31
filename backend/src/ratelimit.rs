//! Per-client rate limiting: a token bucket per client IP, kept in a self-expiring cache.
//!
//! The API is an open proxy in front of our TMDB key, so one abusive client must not be able to
//! get the key throttled for everyone. Limits are generous: a page load makes about ten calls.

use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, Method},
    middleware::Next,
    response::{IntoResponse, Response},
};
use moka::sync::Cache;

use crate::error::AppError;

/// Headers that carry the real client IP, most trustworthy first. On Render, traffic passes
/// through Cloudflare, which overwrites `CF-Connecting-IP` with the address it saw, so a client
/// can't forge it. `X-Forwarded-For`'s first entry is only a fallback for other setups: clients
/// can forge it, so there a determined client could dodge its limit.
const IP_HEADERS: &[&str] = &["cf-connecting-ip", "true-client-ip", "x-real-ip"];

/// Most clients tracked at once; the least recently seen are dropped beyond this.
const MAX_CLIENTS: u64 = 100_000;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RateLimit {
    /// Sustained requests per second per client.
    pub per_second: f64,
    /// Requests a client may make in a burst before being limited.
    pub burst: u32,
}

impl RateLimit {
    pub const DEFAULT: RateLimit = RateLimit {
        per_second: 10.0,
        burst: 60,
    };
}

#[derive(Debug)]
struct Bucket {
    tokens: f64,
    updated: Instant,
}

#[derive(Clone)]
pub struct RateLimiter {
    limit: RateLimit,
    buckets: Cache<String, Arc<Mutex<Bucket>>>,
}

impl RateLimiter {
    pub fn new(limit: RateLimit) -> Self {
        // After this long without requests a bucket would be full again, so forgetting it
        // loses nothing.
        let refill = Duration::from_secs_f64(f64::from(limit.burst) / limit.per_second);
        Self {
            limit,
            buckets: Cache::builder()
                .max_capacity(MAX_CLIENTS)
                .time_to_idle(refill + Duration::from_secs(1))
                .build(),
        }
    }

    /// Takes one token for `client` at time `now`. `Err` carries the seconds until a token frees up.
    pub fn check_at(&self, client: &str, now: Instant) -> Result<(), u64> {
        let burst = f64::from(self.limit.burst);
        let bucket = self.buckets.get_with_by_ref(client, || {
            Arc::new(Mutex::new(Bucket {
                tokens: burst,
                updated: now,
            }))
        });
        let mut b = bucket.lock().unwrap_or_else(|e| e.into_inner());
        let elapsed = now.saturating_duration_since(b.updated).as_secs_f64();
        b.tokens = (b.tokens + elapsed * self.limit.per_second).min(burst);
        b.updated = now;
        if b.tokens >= 1.0 {
            b.tokens -= 1.0;
            Ok(())
        } else {
            let wait = (1.0 - b.tokens) / self.limit.per_second;
            Err(wait.ceil().max(1.0) as u64)
        }
    }
}

/// The client's IP as reported by the proxy in front of us, else the socket peer.
pub fn client_key(headers: &HeaderMap, peer: Option<SocketAddr>) -> String {
    let from_header = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.split(',').next())
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    IP_HEADERS
        .iter()
        .find_map(|h| from_header(h))
        .or_else(|| from_header("x-forwarded-for"))
        .or_else(|| peer.map(|p| p.ip().to_string()))
        .unwrap_or_else(|| "unknown".into())
}

/// Middleware: answers 429 with `Retry-After` once a client runs out of tokens.
/// Health checks and CORS preflights are never limited.
pub async fn limit(State(limiter): State<RateLimiter>, req: Request, next: Next) -> Response {
    if req.method() == Method::OPTIONS || req.uri().path() == "/health" {
        return next.run(req).await;
    }
    let peer = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0);
    let key = client_key(req.headers(), peer);
    match limiter.check_at(&key, Instant::now()) {
        Ok(()) => next.run(req).await,
        Err(retry_after_secs) => {
            tracing::info!(client = %key, "rate limited");
            AppError::TooManyRequests { retry_after_secs }.into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn bucket_allows_burst_then_refills() {
        let limiter = RateLimiter::new(RateLimit {
            per_second: 2.0,
            burst: 3,
        });
        let t0 = Instant::now();
        for _ in 0..3 {
            assert!(limiter.check_at("a", t0).is_ok());
        }
        assert_eq!(limiter.check_at("a", t0), Err(1));
        // Other clients have their own bucket.
        assert!(limiter.check_at("b", t0).is_ok());
        // Half a second at 2/s refills one token.
        assert!(
            limiter
                .check_at("a", t0 + Duration::from_millis(500))
                .is_ok()
        );
        assert!(
            limiter
                .check_at("a", t0 + Duration::from_millis(500))
                .is_err()
        );
        // Never more than the burst, however long the wait.
        let later = t0 + Duration::from_secs(60);
        for _ in 0..3 {
            assert!(limiter.check_at("a", later).is_ok());
        }
        assert!(limiter.check_at("a", later).is_err());
    }

    #[test]
    fn client_key_prefers_proxy_headers() {
        let peer: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        let mut h = HeaderMap::new();
        assert_eq!(client_key(&h, Some(peer)), "10.0.0.1");
        assert_eq!(client_key(&h, None), "unknown");
        h.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.9, 10.1.1.1"),
        );
        assert_eq!(client_key(&h, Some(peer)), "203.0.113.9");
        h.insert("cf-connecting-ip", HeaderValue::from_static("198.51.100.7"));
        assert_eq!(client_key(&h, Some(peer)), "198.51.100.7");
    }
}
