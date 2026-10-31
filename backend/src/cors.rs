//! CORS policy: an explicit origin list. No credentials.

use std::{sync::Arc, time::Duration};

use axum::http::{HeaderValue, Method};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use crate::config::Config;

pub const DEV_ORIGINS: &[&str] = &[
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
];

pub const ALWAYS_ALLOWED: &[&str] = &[
    "https://vod.losingsanity.com",
    "https://vod.losingsanity.xyz",
];

#[derive(Debug, Clone, Default)]
pub struct CorsConfig {
    /// Exact origins (scheme://host[:port]) that are allowed.
    pub origins: Vec<String>,
}

impl CorsConfig {
    pub fn from_config(config: &Config) -> Self {
        let mut origins = config.frontend_origins.clone();
        if config.is_development() {
            origins.extend(DEV_ORIGINS.iter().map(|s| s.to_string()));
        }
        origins.extend(ALWAYS_ALLOWED.iter().map(|s| s.to_string()));
        origins.sort();
        origins.dedup();
        Self { origins }
    }

    pub fn layer(self) -> CorsLayer {
        let cfg = Arc::new(self);
        CorsLayer::new()
            .allow_origin(AllowOrigin::predicate(move |origin: &HeaderValue, _| {
                origin
                    .to_str()
                    .map(|o| is_allowed_origin(&cfg, o))
                    .unwrap_or(false)
            }))
            .allow_methods([Method::GET, Method::OPTIONS])
            .allow_headers(Any)
            .max_age(Duration::from_secs(60 * 60))
    }
}

/// Whether a browser `Origin` header value is allowed.
pub fn is_allowed_origin(cfg: &CorsConfig, origin: &str) -> bool {
    cfg.origins.iter().any(|o| o == origin)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(env: &str, frontend: &str) -> Config {
        Config::from_lookup(|k| match k {
            "TMDB_API_KEY" => Some("k".into()),
            "ENVIRONMENT" => Some(env.into()),
            "FRONTEND_ORIGIN" => Some(frontend.into()),
            _ => None,
        })
        .unwrap()
    }

    #[test]
    fn development_allows_localhost() {
        let cfg = CorsConfig::from_config(&config("development", ""));
        for o in DEV_ORIGINS {
            assert!(is_allowed_origin(&cfg, o), "{o}");
        }
        assert!(!is_allowed_origin(&cfg, "http://localhost:8080"));
    }

    #[test]
    fn production_rejects_localhost_but_allows_env_and_fixed() {
        let cfg =
            CorsConfig::from_config(&config("production", "https://my.app, https://other.app/"));
        assert!(!is_allowed_origin(&cfg, "http://localhost:5173"));
        assert!(is_allowed_origin(&cfg, "https://my.app"));
        assert!(is_allowed_origin(&cfg, "https://other.app"));
        assert!(is_allowed_origin(&cfg, "https://vod.losingsanity.com"));
        assert!(is_allowed_origin(&cfg, "https://vod.losingsanity.xyz"));
        assert!(!is_allowed_origin(&cfg, "http://vod.losingsanity.com"));
        assert!(!is_allowed_origin(&cfg, "https://evil.com"));
    }
}
