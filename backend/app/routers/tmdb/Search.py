from Tmdb import tmdb_get
from fastapi import APIRouter
from typing import Optional

router = APIRouter()

def search_by_id(query: str, source: str):
    return tmdb_get(f"/find/{query}", source)

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
            print('d')
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
        case _:
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