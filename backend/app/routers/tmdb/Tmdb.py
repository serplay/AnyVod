from fastapi import APIRouter, HTTPException
import os
import requests
from dotenv import load_dotenv
from typing import Optional, List

load_dotenv()

router = APIRouter()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
VIDSRC_EMBED_DOMAIN = os.getenv("VIDSRC_EMBED_DOMAIN", "vidsrc-embed.ru")
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


def sort_results(results: List[dict], sort_by: str) -> List[dict]:
    """Sort results client-side based on sort_by parameter"""
    if not results or sort_by == 'relevance':
        return results
    
    if sort_by == 'title_asc':
        return sorted(results, key=lambda x: (x.get('title') or x.get('name') or '').lower())
    elif sort_by == 'title_desc':
        return sorted(results, key=lambda x: (x.get('title') or x.get('name') or '').lower(), reverse=True)
    elif sort_by == 'rating_desc':
        return sorted(results, key=lambda x: x.get('vote_average', 0), reverse=True)
    elif sort_by == 'rating_asc':
        return sorted(results, key=lambda x: x.get('vote_average', 0))
    elif sort_by == 'date_desc':
        return sorted(results, key=lambda x: x.get('release_date') or x.get('first_air_date') or '', reverse=True)
    elif sort_by == 'date_asc':
        return sorted(results, key=lambda x: x.get('release_date') or x.get('first_air_date') or '')
    elif sort_by == 'popularity_desc':
        return sorted(results, key=lambda x: x.get('popularity', 0), reverse=True)
    
    return results


def filter_by_rating(results: List[dict], min_rating: Optional[float]) -> List[dict]:
    """Filter results by minimum rating"""
    if not min_rating:
        return results
    return [r for r in results if r.get('vote_average', 0) >= min_rating]


@router.get("/search")
def search_movies(
    query: str, 
    page: int = 1, 
    type: Optional[str] = None, 
    year: Optional[int] = None, 
    exid: Optional[str] = None,
    sort_by: Optional[str] = 'relevance',
    min_rating: Optional[float] = None,
    genre: Optional[int] = None
):
    """
    Enhanced search with filters and sorting.
    
    - type: 'movie', 'tv', 'person', or None for multi-search
    - sort_by: 'relevance', 'title_asc', 'title_desc', 'rating_desc', 'rating_asc', 
               'date_desc', 'date_asc', 'popularity_desc'
    - min_rating: minimum rating (0-10)
    - genre: genre ID to filter by
    """
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
    
    # Handle person search
    if type == 'person':
        results = tmdb_get('/search/person', params)
        results['results'] = sort_results(results.get('results', []), sort_by)
        return results
        
    # Movie search
    if type == 'movie':
        if year:
            params['year'] = year
        results = tmdb_get('/search/movie', params)
        filtered = filter_by_rating(results.get('results', []), min_rating)
        if genre:
            filtered = [r for r in filtered if genre in r.get('genre_ids', [])]
        results['results'] = sort_results(filtered, sort_by)
        return results
    
    # TV search
    elif type == 'tv':
        results = tmdb_get('/search/tv', params)
        filtered = results.get('results', [])
        if year:
            filtered = [r for r in filtered if r.get('first_air_date', '').startswith(str(year))]
        filtered = filter_by_rating(filtered, min_rating)
        if genre:
            filtered = [r for r in filtered if genre in r.get('genre_ids', [])]
        results['results'] = sort_results(filtered, sort_by)
        return results
    
    # Multi search (all)
    else:
        results = tmdb_get('/search/multi', params)
        filtered = results.get('results', [])
        filtered = filter_by_rating(filtered, min_rating)
        if genre:
            filtered = [r for r in filtered if genre in r.get('genre_ids', [])]
        results['results'] = sort_results(filtered, sort_by)
        return results


@router.get("/discover/movie")
def discover_movies(
    page: int = 1,
    sort_by: str = 'popularity.desc',
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    year: Optional[int] = None,
    genre: Optional[int] = None,
    with_genres: Optional[str] = None
):
    """
    Discover movies with advanced filtering (no search query needed).
    Uses TMDB's /discover/movie endpoint.
    """
    params = {"page": page, "sort_by": sort_by}
    
    if min_rating:
        params['vote_average.gte'] = min_rating
    if max_rating:
        params['vote_average.lte'] = max_rating
    if year:
        params['primary_release_year'] = year
    if genre:
        params['with_genres'] = genre
    elif with_genres:
        params['with_genres'] = with_genres
        
    return tmdb_get('/discover/movie', params)


@router.get("/discover/tv")
def discover_tv(
    page: int = 1,
    sort_by: str = 'popularity.desc',
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    year: Optional[int] = None,
    genre: Optional[int] = None,
    with_genres: Optional[str] = None
):
    """
    Discover TV shows with advanced filtering.
    Uses TMDB's /discover/tv endpoint.
    """
    params = {"page": page, "sort_by": sort_by}
    
    if min_rating:
        params['vote_average.gte'] = min_rating
    if max_rating:
        params['vote_average.lte'] = max_rating
    if year:
        params['first_air_date_year'] = year
    if genre:
        params['with_genres'] = genre
    elif with_genres:
        params['with_genres'] = with_genres
        
    return tmdb_get('/discover/tv', params)


@router.get("/genres/movie")
def movie_genres():
    """Get list of movie genres"""
    return tmdb_get('/genre/movie/list')


@router.get("/genres/tv")
def tv_genres():
    """Get list of TV genres"""
    return tmdb_get('/genre/tv/list')


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
