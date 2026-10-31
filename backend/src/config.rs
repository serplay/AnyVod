//! Runtime configuration loaded from environment variables.

use std::env;

use crate::ratelimit::RateLimit;

pub const DEFAULT_TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";
pub const DEFAULT_VIDSRC_EMBED_DOMAIN: &str = "vidsrc.sh";
pub const DEFAULT_PORT: u16 = 8000;

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("TMDB_API_KEY is not set")]
    MissingTmdbApiKey,
    #[error("PORT is not a valid port number: {0}")]
    InvalidPort(String),
    #[error("{0} must be a non-negative number, got {1:?}")]
    InvalidNumber(&'static str, String),
}

#[derive(Debug, Clone)]
pub struct Config {
    pub tmdb_api_key: String,
    /// Base URL of the TMDB v3 API, without a trailing slash.
    pub tmdb_base_url: String,
    /// Domain used for vidsrc embeds, e.g. `vidsrc.sh`.
    pub vidsrc_embed_domain: String,
    /// Base URL (scheme + host) for vidsrc requests and embed URLs, without a trailing slash.
    pub vidsrc_base_url: String,
    /// Extra allowed CORS origins from `FRONTEND_ORIGIN` (comma separated).
    pub frontend_origins: Vec<String>,
    pub environment: String,
    pub port: u16,
    /// Per-client-IP limit, from `RATE_LIMIT_PER_SEC` / `RATE_LIMIT_BURST`. `None` when either
    /// is set to 0.
    pub rate_limit: Option<RateLimit>,
}

impl Config {
    /// Builds the config from the process environment.
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    /// Builds the config from an arbitrary key lookup (used by tests).
    pub fn from_lookup<F>(lookup: F) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        let non_empty = |key: &str| {
            lookup(key)
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };

        let tmdb_api_key = non_empty("TMDB_API_KEY").ok_or(ConfigError::MissingTmdbApiKey)?;
        let tmdb_base_url = non_empty("TMDB_BASE_URL")
            .unwrap_or_else(|| DEFAULT_TMDB_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string();
        let vidsrc_embed_domain = non_empty("VIDSRC_EMBED_DOMAIN")
            .unwrap_or_else(|| DEFAULT_VIDSRC_EMBED_DOMAIN.to_string());
        let vidsrc_base_url = non_empty("VIDSRC_BASE_URL")
            .unwrap_or_else(|| format!("https://{vidsrc_embed_domain}"))
            .trim_end_matches('/')
            .to_string();
        let frontend_origins = parse_origin_list(&non_empty("FRONTEND_ORIGIN").unwrap_or_default());
        let environment = non_empty("ENVIRONMENT").unwrap_or_else(|| "development".to_string());
        let port = match non_empty("PORT") {
            Some(p) => p.parse().map_err(|_| ConfigError::InvalidPort(p))?,
            None => DEFAULT_PORT,
        };

        let number = |key: &'static str| -> Result<Option<f64>, ConfigError> {
            match non_empty(key) {
                None => Ok(None),
                Some(v) => match v.parse::<f64>() {
                    Ok(n) if n.is_finite() && n >= 0.0 => Ok(Some(n)),
                    _ => Err(ConfigError::InvalidNumber(key, v)),
                },
            }
        };
        let per_second = number("RATE_LIMIT_PER_SEC")?.unwrap_or(RateLimit::DEFAULT.per_second);
        let burst = number("RATE_LIMIT_BURST")?
            .map(|b| b.min(f64::from(u32::MAX)) as u32)
            .unwrap_or(RateLimit::DEFAULT.burst);
        let rate_limit = (per_second > 0.0 && burst > 0).then_some(RateLimit { per_second, burst });

        Ok(Self {
            rate_limit,
            tmdb_api_key,
            tmdb_base_url,
            vidsrc_embed_domain,
            vidsrc_base_url,
            frontend_origins,
            environment,
            port,
        })
    }

    pub fn is_development(&self) -> bool {
        self.environment.eq_ignore_ascii_case("development")
    }
}

/// Splits a comma separated origin list, trimming whitespace and trailing slashes.
pub fn parse_origin_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|o| o.trim().trim_end_matches('/'))
        .filter(|o| !o.is_empty())
        .map(str::to_string)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn cfg(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Config::from_lookup(|k| map.get(k).cloned())
    }

    #[test]
    fn missing_api_key_fails() {
        assert!(matches!(cfg(&[]), Err(ConfigError::MissingTmdbApiKey)));
        assert!(matches!(
            cfg(&[("TMDB_API_KEY", "  ")]),
            Err(ConfigError::MissingTmdbApiKey)
        ));
    }

    #[test]
    fn defaults() {
        let c = cfg(&[("TMDB_API_KEY", "k")]).unwrap();
        assert_eq!(c.tmdb_base_url, DEFAULT_TMDB_BASE_URL);
        assert_eq!(c.vidsrc_embed_domain, "vidsrc.sh");
        assert_eq!(c.vidsrc_base_url, "https://vidsrc.sh");
        assert_eq!(c.environment, "development");
        assert_eq!(c.port, 8000);
        assert!(c.frontend_origins.is_empty());
        assert_eq!(c.rate_limit, Some(RateLimit::DEFAULT));
    }

    #[test]
    fn rate_limit_settings() {
        let c = cfg(&[
            ("TMDB_API_KEY", "k"),
            ("RATE_LIMIT_PER_SEC", "2.5"),
            ("RATE_LIMIT_BURST", "20"),
        ])
        .unwrap();
        assert_eq!(
            c.rate_limit,
            Some(RateLimit {
                per_second: 2.5,
                burst: 20
            })
        );
        let off = cfg(&[("TMDB_API_KEY", "k"), ("RATE_LIMIT_PER_SEC", "0")]).unwrap();
        assert_eq!(off.rate_limit, None);
        assert!(matches!(
            cfg(&[("TMDB_API_KEY", "k"), ("RATE_LIMIT_BURST", "-1")]),
            Err(ConfigError::InvalidNumber(..))
        ));
    }

    #[test]
    fn overrides() {
        let c = cfg(&[
            ("TMDB_API_KEY", "k"),
            ("TMDB_BASE_URL", "http://127.0.0.1:9/3/"),
            ("VIDSRC_EMBED_DOMAIN", "example.org"),
            ("FRONTEND_ORIGIN", " https://a.com/, ,https://b.com"),
            ("ENVIRONMENT", "production"),
            ("PORT", "9000"),
        ])
        .unwrap();
        assert_eq!(c.tmdb_base_url, "http://127.0.0.1:9/3");
        assert_eq!(c.vidsrc_base_url, "https://example.org");
        assert_eq!(c.frontend_origins, vec!["https://a.com", "https://b.com"]);
        assert!(!c.is_development());
        assert_eq!(c.port, 9000);
    }

    #[test]
    fn invalid_port() {
        assert!(matches!(
            cfg(&[("TMDB_API_KEY", "k"), ("PORT", "abc")]),
            Err(ConfigError::InvalidPort(_))
        ));
    }
}
