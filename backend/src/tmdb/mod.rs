//! TMDB proxy: caching client, routes, and search post-processing.

pub mod client;
pub mod routes;
pub mod search;

pub use client::TmdbClient;
