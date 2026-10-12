//! `Query` / `Path` extractors whose rejections render as `{"detail": ...}` with status 400.

use std::str::FromStr;

use axum::extract::FromRequestParts;
use serde::{Deserialize, Deserializer, de::DeserializeOwned, de::IntoDeserializer};

use crate::error::AppError;

#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Query), rejection(AppError))]
pub struct Query<T>(pub T);

#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Path), rejection(AppError))]
pub struct Path<T>(pub T);

/// Deserializes an optional enum from a query string, treating `""` as absent.
pub fn opt_enum<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: DeserializeOwned,
{
    match Option::<String>::deserialize(d)? {
        Some(s) if !s.trim().is_empty() => T::deserialize(s.trim().into_deserializer()).map(Some),
        _ => Ok(None),
    }
}

/// Deserializes an optional `FromStr` value from a query string, treating `""` as absent.
pub fn opt_parse<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: FromStr,
    T::Err: std::fmt::Display,
{
    match Option::<String>::deserialize(d)? {
        Some(s) if !s.trim().is_empty() => {
            s.trim().parse().map(Some).map_err(serde::de::Error::custom)
        }
        _ => Ok(None),
    }
}
