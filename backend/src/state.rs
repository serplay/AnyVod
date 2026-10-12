//! Shared application state.

use std::{sync::Arc, time::Duration};

use crate::{config::Config, tmdb::TmdbClient, vidsrc::VidsrcClient};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub tmdb: TmdbClient,
    pub vidsrc: VidsrcClient,
}

impl AppState {
    pub fn new(config: Config) -> Result<Self, reqwest::Error> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("anyvod-backend/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .build()?;
        Ok(Self {
            tmdb: TmdbClient::new(http.clone(), &config.tmdb_base_url, &config.tmdb_api_key),
            vidsrc: VidsrcClient::new(http, &config.vidsrc_base_url),
            config: Arc::new(config),
        })
    }
}
