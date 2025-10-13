from fastapi import APIRouter, HTTPException
import os
import requests
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

router = APIRouter()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE = "https://api.themoviedb.org/3"


def tmdb_get(path, params=None):
    if params is None:
        params = {}
    if not TMDB_API_KEY:
        raise RuntimeError("TMDB_API_KEY not set in environment")
    params = {**params, "api_key": TMDB_API_KEY}
    url = f"{TMDB_BASE}{path}"
    resp = requests.get(url, params=params, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("/popular")
def popular(page: int = 1):
    return tmdb_get("/movie/popular", {"page": page})


@router.get("/movie/{movie_id}")
def movie_details(movie_id: int):
    return tmdb_get(f"/movie/{movie_id}")


@router.get("/search")


def search_movies(query: str, page: int = 1, type: Optional[str] = None, year: Optional[int] = None):
    # Supports optional filtering by type (movie|tv) and year.
    # - type=movie: use /search/movie and pass year as 'year' (TMDB supports this)
    # - type=tv: if year provided, use /discover/tv with first_air_date_year; otherwise /search/tv
    # - no type: fallback to /search/multi
    params = {"query": query, "page": page}
    if type == 'movie':
        if year:
            params['year'] = year
        return tmdb_get('/search/movie', params)
    elif type == 'tv':
        if year:
            # the discover endpoint expects different params; include query via with_text_query is not supported
            # so we'll call /search/tv and filter by year client-side
            results = tmdb_get('/search/tv', params)
            if year:
                # filter results client-side by first_air_date starting with the year
                results['results'] = [r for r in results.get('results', []) if r.get('first_air_date', '').startswith(str(year))]
            return results
        else:
            return tmdb_get('/search/tv', params)
    else:
        # combined multi search
        return tmdb_get('/search/multi', params)


@router.get("/image_base")
def image_base():
    # return configuration for building image urls
    return tmdb_get("/configuration")
