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

/// TMDB serves at most 500 pages of any list, and answers 400 beyond that.
pub const MAX_PAGE: u32 = 500;

/// `page` defaulted to 1 and checked against `1..=max`.
pub fn checked_page(page: Option<u32>, max: u32) -> Result<u32, AppError> {
    let page = page.unwrap_or(1);
    if (1..=max).contains(&page) {
        Ok(page)
    } else {
        Err(AppError::BadRequest(format!(
            "page must be between 1 and {max}"
        )))
    }
}

/// Checks an optional rating filter is within TMDB's 0-10 scale.
pub fn checked_rating(name: &str, value: Option<f64>) -> Result<Option<f64>, AppError> {
    match value {
        Some(v) if !(0.0..=10.0).contains(&v) => Err(AppError::BadRequest(format!(
            "{name} must be between 0 and 10"
        ))),
        other => Ok(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_bounds() {
        assert_eq!(checked_page(None, MAX_PAGE).unwrap(), 1);
        assert_eq!(checked_page(Some(500), MAX_PAGE).unwrap(), 500);
        assert!(checked_page(Some(0), MAX_PAGE).is_err());
        assert!(checked_page(Some(501), MAX_PAGE).is_err());
    }

    #[test]
    fn rating_bounds() {
        assert_eq!(checked_rating("r", Some(10.0)).unwrap(), Some(10.0));
        assert_eq!(checked_rating("r", None).unwrap(), None);
        assert!(checked_rating("r", Some(-1.0)).is_err());
        assert!(checked_rating("r", Some(f64::NAN)).is_err());
    }
}
