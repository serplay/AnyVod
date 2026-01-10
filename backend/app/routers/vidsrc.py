from fastapi import APIRouter, HTTPException
import requests
from dotenv import load_dotenv
from typing import Optional
import os

load_dotenv()

router = APIRouter()

# Default vidsrc domain; can be overridden with env VIDSRC_EMBED_DOMAIN
VIDSRC_EMBED_DOMAIN = os.getenv("VIDSRC_EMBED_DOMAIN", "vidsrc-embed.ru")


def build_embed_url(kind: str, *, tmdb: Optional[str] = None, imdb: Optional[str] = None, season: Optional[int] = None, episode: Optional[int] = None, ds_lang: Optional[str] = None, sub_url: Optional[str] = None, autoplay: Optional[int] = None, autonext: Optional[int] = None):
    # kind is one of: movie, tv
    base = f"https://{VIDSRC_EMBED_DOMAIN}/embed/{kind}"

    # if we have a tmdb or imdb id, prefer the path form
    if tmdb:
        url = f"{base}/{tmdb}"
    elif imdb:
        url = f"{base}/{imdb}"
    else:
        # fallback to query params
        params = []
        if tmdb:
            params.append(f"tmdb={tmdb}")
        if imdb:
            params.append(f"imdb={imdb}")
        if ds_lang:
            params.append(f"ds_lang={ds_lang}")
        if sub_url:
            params.append(f"sub_url={sub_url}")
        if autoplay is not None:
            params.append(f"autoplay={autoplay}")
        if autonext is not None:
            params.append(f"autonext={autonext}")
        qs = "&".join(params)
        url = f"{base}?{qs}" if qs else base

    # If season & episode provided for tv, and we have a valid id, append /{season}-{episode}
    if kind == "tv" and season is not None and episode is not None:
        id_part = tmdb or imdb
        if id_part:
            url = f"{base}/{id_part}/{season}-{episode}"

    return url


@router.get("/embed/movie")
def embed_movie(tmdb: Optional[str] = None, imdb: Optional[str] = None, ds_lang: Optional[str] = None, sub_url: Optional[str] = None, autoplay: Optional[int] = None):
    # return the embed URL for a movie
    url = build_embed_url("movie", tmdb=tmdb, imdb=imdb, ds_lang=ds_lang, sub_url=sub_url, autoplay=autoplay)
    return {"embed_url": url}


@router.get("/embed/tv")
def embed_tv(tmdb: Optional[str] = None, imdb: Optional[str] = None, ds_lang: Optional[str] = None, season: Optional[int] = None, episode: Optional[int] = None, sub_url: Optional[str] = None, autoplay: Optional[int] = None, autonext: Optional[int] = None):
    url = build_embed_url("tv", tmdb=tmdb, imdb=imdb, ds_lang=ds_lang, season=season, episode=episode, sub_url=sub_url, autoplay=autoplay, autonext=autonext)
    return {"embed_url": url}


@router.get("/latest/movies")
def latest_movies(page: int = 1):
    # proxy JSON list from vidsrc
    url = f"https://{VIDSRC_EMBED_DOMAIN}/movies/latest/page-{page}.json"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("/latest/tvshows")
def latest_tvshows(page: int = 1):
    url = f"https://{VIDSRC_EMBED_DOMAIN}/tvshows/latest/page-{page}.json"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()

def check_embed_availability(embed_url: str) -> dict:
    """
    Check if video is available by requesting the embed page.
    Since the page uses JavaScript, we check for common patterns in the HTML
    that indicate availability or unavailability.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": f"https://{VIDSRC_EMBED_DOMAIN}/",
    }
    
    try:
        resp = requests.get(embed_url, headers=headers, timeout=15, allow_redirects=True)
        
        # If we get a non-200 status, it's not available
        if resp.status_code != 200:
            return {"available": False, "reason": f"HTTP {resp.status_code}"}
        
        content = resp.text.lower()
        
        # Check for common error/unavailable indicators
        unavailable_indicators = [
            "not found",
            "no sources",
            "unavailable",
            "error 404",
            "doesn't exist",
            "does not exist",
            "no video",
            "removed",
            "dmca",
        ]
        
        for indicator in unavailable_indicators:
            if indicator in content:
                return {"available": False, "reason": indicator}
        
        # Check for positive indicators (video player elements, source scripts, etc.)
        available_indicators = [
            "iframe",
            "player",
            "video",
            "source",
            "embed",
            "stream",
        ]
        
        has_positive = any(ind in content for ind in available_indicators)
        
        # If page loaded successfully and has player-related content, assume available
        if has_positive:
            return {"available": True, "embed_url": embed_url}
        
        # Default: if we got a 200 response with content, tentatively mark as available
        if len(content) > 500:
            return {"available": True, "embed_url": embed_url, "confidence": "low"}
        
        return {"available": False, "reason": "empty or minimal response"}
        
    except requests.Timeout:
        return {"available": False, "reason": "timeout"}
    except requests.RequestException as e:
        return {"available": False, "reason": str(e)}


@router.get("/movie/availability/{tmdb_id}")
def movie_availability(tmdb_id: int):
    embed_url = build_embed_url("movie", tmdb=str(tmdb_id))
    result = check_embed_availability(embed_url)
    result["tmdb_id"] = tmdb_id
    result["type"] = "movie"
    return result


@router.get("/tv/availability/{tmdb_id}")
def tv_availability(tmdb_id: int, season: Optional[int] = None, episode: Optional[int] = None):
    embed_url = build_embed_url("tv", tmdb=str(tmdb_id), season=season, episode=episode)
    result = check_embed_availability(embed_url)
    result["tmdb_id"] = tmdb_id
    result["type"] = "tv"
    if season:
        result["season"] = season
    if episode:
        result["episode"] = episode
    return result