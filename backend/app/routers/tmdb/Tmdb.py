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

def search_by_id(query: str, source: str):
    return tmdb_get(f"/find/{query}", {"external_id":source})

@router.get("/search")
def search_movies(query: str, page: int = 1, type: Optional[str] = None, year: Optional[int] = None, exid: Optional[str] = None):
    # Supports optional filtering by type (movie|tv) and year.
    # - type=movie: use /search/movie and pass year as 'year' (TMDB supports this)
    # - type=tv: if year provided, use /discover/tv with first_air_date_year; otherwise /search/tv
    
    params = {"query": query, "page": page}
    
    match exid:
        case "tmdb":
            return 
        case "imdb":
            return search_by_id(query, "imdb_id")
        case "fb":
            return
        case "ig":
            return
        case "tvdb":
            return
        case "tt":
            return
        case "x":
            return
        case "wd":
            return
        case "yt":
            return
        
    # - no type: fallback to /search/multi
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


@router.get("/popular")
def popular(page: int = 1):
    return tmdb_get("/movie/popular", {"page": page})


@router.get("/trending/{media_type}/{time_window}")
def trending(media_type: str = "all", time_window: str = "day"):
    # media_type: all, movie, tv, person
    # time_window: day, week
    return tmdb_get(f"/trending/{media_type}/{time_window}")


@router.get("/movie/top_rated")
def movie_top_rated(page: int = 1):
    return tmdb_get("/movie/top_rated", {"page": page})


@router.get("/movie/upcoming")
def movie_upcoming(page: int = 1):
    return tmdb_get("/movie/upcoming", {"page": page})


@router.get("/movie/now_playing")
def movie_now_playing(page: int = 1):
    return tmdb_get("/movie/now_playing", {"page": page})


@router.get("/tv/popular")
def tv_popular(page: int = 1):
    return tmdb_get("/tv/popular", {"page": page})


@router.get("/tv/top_rated")
def tv_top_rated(page: int = 1):
    return tmdb_get("/tv/top_rated", {"page": page})


@router.get("/tv/on_the_air")
def tv_on_the_air(page: int = 1):
    return tmdb_get("/tv/on_the_air", {"page": page})


@router.get("/movie/{movie_id}")
def movie_details(movie_id: int):
    # include credits, images and videos for a richer payload
    return tmdb_get(f"/movie/{movie_id}", {"append_to_response": "credits,images,videos"})


@router.get("/tv/{tv_id}")
def tv_details(tv_id: int):
    # include credits, images and videos
    return tmdb_get(f"/tv/{tv_id}", {"append_to_response": "credits,images,videos"})


@router.get("/tv/{tv_id}/season/{season_number}")
def tv_season(tv_id: int, season_number: int):
    return tmdb_get(f"/tv/{tv_id}/season/{season_number}")


@router.get("/image_base")
def image_base():
    # return configuration for building image urls
    return tmdb_get("/configuration")


@router.get('/person/{person_id}')
def person_details(person_id: int):
    # include external_ids maybe later
    return tmdb_get(f"/person/{person_id}")


@router.get('/person/{person_id}/combined_credits')
def person_credits(person_id: int):
    return tmdb_get(f"/person/{person_id}/combined_credits")


@router.get('/movie/{movie_id}/similar')
def movie_similar(movie_id: int, page: int = 1):
    return tmdb_get(f"/movie/{movie_id}/similar", {"page": page})


@router.get('/tv/{tv_id}/similar')
def tv_similar(tv_id: int, page: int = 1):
    return tmdb_get(f"/tv/{tv_id}/similar", {"page": page})
