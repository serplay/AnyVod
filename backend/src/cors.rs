//! CORS policy: explicit origin list plus this account's own Vercel deployments. No credentials.

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

/// The Vercel scope (team slug) that owns the frontend projects. Preview URLs end with it:
/// `<project>-<hash>-<scope>.vercel.app` and `<project>-git-<branch>-<scope>.vercel.app`.
pub const VERCEL_SCOPE: &str = "infinitys-projects-38b16f39";

/// Production aliases of the Vercel projects (`<project>.vercel.app`).
pub const VERCEL_PROJECTS: &[&str] = &["any-vod", "any-vod-frontend"];

/// Returns true for this account's own Vercel deployments: a project's production alias, or
/// any preview URL under [`VERCEL_SCOPE`]. Other `*.vercel.app` sites can be deployed by anyone,
/// so they are not allowed.
pub fn is_vercel_preview(origin: &str) -> bool {
    let Some(host) = origin
        .strip_prefix("https://")
        .and_then(|rest| rest.strip_suffix(".vercel.app"))
    else {
        return false;
    };
    let is_label = !host.is_empty()
        && host
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !is_label {
        return false;
    }
    VERCEL_PROJECTS.contains(&host)
        || host
            .strip_suffix(VERCEL_SCOPE)
            .is_some_and(|prefix| prefix.len() > 1 && prefix.ends_with('-'))
}

/// Whether a browser `Origin` header value is allowed.
pub fn is_allowed_origin(cfg: &CorsConfig, origin: &str) -> bool {
    cfg.origins.iter().any(|o| o == origin) || is_vercel_preview(origin)
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

    #[test]
    fn vercel_predicate() {
        let cfg = CorsConfig::default();
        // own production aliases and previews
        assert!(is_allowed_origin(&cfg, "https://any-vod.vercel.app"));
        assert!(is_allowed_origin(
            &cfg,
            "https://any-vod-frontend.vercel.app"
        ));
        assert!(is_allowed_origin(
            &cfg,
            "https://any-vod-git-main-infinitys-projects-38b16f39.vercel.app"
        ));
        assert!(is_allowed_origin(
            &cfg,
            "https://any-vod-frontend-k3j2h1g0f-infinitys-projects-38b16f39.vercel.app"
        ));
        // anyone else's vercel.app site
        assert!(!is_allowed_origin(&cfg, "https://anyvod.vercel.app"));
        assert!(!is_allowed_origin(&cfg, "https://evil.vercel.app"));
        assert!(!is_allowed_origin(
            &cfg,
            "https://evil-git-main-someone-else.vercel.app"
        ));
        assert!(!is_allowed_origin(
            &cfg,
            "https://evilinfinitys-projects-38b16f39.vercel.app"
        ));
        assert!(!is_allowed_origin(
            &cfg,
            "https://infinitys-projects-38b16f39.vercel.app"
        ));
        assert!(!is_allowed_origin(
            &cfg,
            "https://a.any-vod-git-x-infinitys-projects-38b16f39.vercel.app"
        ));
        assert!(!is_allowed_origin(&cfg, "https://a.b.vercel.app"));
        assert!(!is_allowed_origin(&cfg, "https://vercel.app"));
        assert!(!is_allowed_origin(&cfg, "https://.vercel.app"));
        assert!(!is_allowed_origin(&cfg, "http://anyvod.vercel.app"));
        assert!(!is_allowed_origin(
            &cfg,
            "https://anyvod.vercel.app.evil.com"
        ));
        assert!(!is_allowed_origin(&cfg, "https://evil.com/.vercel.app"));
        assert!(!is_allowed_origin(&cfg, "https://evil.com:443.vercel.app"));
    }
}
