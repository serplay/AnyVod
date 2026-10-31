# AnyVod API

The base URL comes from the frontend's `VITE_API_BASE`. Every route is `GET` and returns JSON.

Errors return `{ "detail": string }`, using one of these statuses:
- `400` for bad input (checked before anything is sent upstream)
- upstream client errors such as `404`, passed through with upstream's `status_message` as `detail`
- `429` with `Retry-After` when one client sends too many requests (per IP; see `RATE_LIMIT_*` in the README). `/health` is never limited.
- `502` when upstream fails or rejects our credentials (the upstream body is logged, never returned)
- `503` when upstream is rate limiting us
- `504` when the upstream times out

`Cache-Control` is `public, max-age=300` on successful responses, except genres (`86400`) and person routes (`3600`).

Most TMDB routes pass TMDB's response body through unchanged. The **Fields used** column lists the fields the frontend depends on; the frontend types in `frontend/src/api/types.ts` model only those fields.

## Service

| Route | Response |
|---|---|
| `/` | `{ "message": "Welcome to the AnyVod API" }` |
| `/health` | `{ "status": "ok" }` |

## TMDB (`/tmdb`)

The list routes take an optional `page` (default 1, at most 500, TMDB's limit) and return `{ page, results[], total_pages, total_results }`.

The fields used on list items are:
- `id`, `media_type?`, `title?`, `name?`
- `poster_path`, `backdrop_path`
- `release_date?`, `first_air_date?`
- `vote_average`, `popularity`, `genre_ids`

| Route | Params | Upstream / notes |
|---|---|---|
| `/trending/{media_type}/{time_window}` | – | `media_type` ∈ `all\|movie\|tv\|person`. `time_window` ∈ `day\|week`. |
| `/popular`, `/movie/popular` | page | `/movie/popular` (the two routes are aliases) |
| `/movie/top_rated`, `/movie/upcoming`, `/movie/now_playing` | page | same as the upstream path |
| `/tv/popular`, `/tv/top_rated`, `/tv/on_the_air` | page | same as the upstream path |
| `/movie/{id}`, `/tv/{id}` | – | Detail routes. See [Detail routes](#detail-routes) below. |
| `/movie/{id}/similar`, `/tv/{id}/similar` | page | list |
| `/tv/{id}/season/{n}` | – | See [Season route](#season-route) below. |
| `/genres/movie`, `/genres/tv` | – | `{ genres: [{ id, name }] }` (cached for 24h) |
| `/person/{id}` | – | See [Person routes](#person-routes) below. |
| `/person/{id}/combined_credits` | – | See [Person routes](#person-routes) below. |
| `/discover/movie`, `/discover/tv` | `page, sort_by (TMDB form, default popularity.desc), min_rating, max_rating, year, genre, with_genres` | list. `sort_by` must be a field TMDB sorts that kind by plus `.asc`/`.desc`; ratings are 0–10, `year` 1870–2100, `with_genres` ids joined by `,` or `\|`. |
| `/search` | see below | list |

### Detail routes

`/movie/{id}` and `/tv/{id}` call TMDB with `append_to_response=credits,images,videos`.

The fields used are:
- `id`, `title`, `name`, `overview`, `poster_path`, `backdrop_path`
- `vote_average`, `vote_count`, `release_date`, `first_air_date`
- `genres[{id,name}]`
- `runtime`, `episode_run_time[]`
- `number_of_seasons`, `seasons[{season_number,name,episode_count}]`
- `external_ids?`, `imdb_id?`
- `videos.results[{type,site,key}]`
- `credits.cast[{id,name,character,profile_path}]`

### Season route

`/tv/{id}/season/{n}` returns `name`, `overview` and `episodes[]`.

The fields used on each episode are `id`, `episode_number`, `name`, `still_path`, `runtime`, `vote_average`, `overview` and `air_date`.

### Person routes

`/person/{id}` returns:
- `id`, `name`, `profile_path`, `biography`, `popularity`
- `birthday`, `deathday`, `place_of_birth`, `known_for_department`

`/person/{id}/combined_credits` returns `cast[]`. The fields used on each entry are:
- `credit_id`, `id`, `media_type`, `title`, `name`, `character`
- `poster_path`, `popularity`, `vote_average`
- `release_date`, `first_air_date`

### `/tmdb/search`

| Param | Type | Notes |
|---|---|---|
| `query` | string, required | Not blank, at most 200 characters. |
| `page` | int, default 1 | At most 500, or 166 when filters run locally (see below). |
| `type` | `movie\|tv\|person` | If omitted, uses TMDB multi search. |
| `year` | int | Movie search sends it upstream. TV and multi search filter on the date prefix instead. |
| `sort_by` | `relevance` (default), `title_asc`, `title_desc`, `rating_desc`, `rating_asc`, `date_desc`, `date_asc`, `popularity_desc` | Sorts the current page. |
| `min_rating` | float 0–10 | Filters on `vote_average`. |
| `genre` | int | Keeps results that have this genre id. |
| `genres` | comma-separated ints | Keeps results that have **all** of these ids. Merged with `genre` if both are given. |
| `exid` | `imdb\|tvdb\|fb\|ig\|x\|wd\|yt\|tt` | Treats `query` as an external id and returns TMDB `/find/{query}?external_source=…`. `tmdb` → `400`. |

The `exid` values map to TMDB `external_source` values as follows:

| `exid` | `external_source` |
|---|---|
| `imdb` | `imdb_id` |
| `tvdb` | `tvdb_id` |
| `fb` | `facebook_id` |
| `ig` | `instagram_id` |
| `x` | `twitter_id` |
| `wd` | `wikidata_id` |
| `yt` | `youtube_id` |
| `tt` | `tiktok_id` |

An invalid `sort_by`, `type` or `exid` returns `400`.

**Local filters and paging.** TMDB search can't filter by rating or genre (or by year, except for movies), so those filters run here. When any of them is active, one page of our results is built from **three** TMDB pages (our page N = TMDB pages 3N-2 to 3N), so filtered pages aren't nearly empty. The response then has:
- `total_pages`: TMDB's page count divided by 3, rounded up
- `total_results`: TMDB's count *before* filtering
- `filtered_from`: how many items the filters were applied to (the response leaves it out when no filter ran locally)

Without local filters, pages map one to one. Sorting always applies to the items on the returned page.

## vidsrc (`/vidsrc`)

The default `VIDSRC_EMBED_DOMAIN` is `vidsrc.sh`.

| Route | Params | Response |
|---|---|---|
| `/embed/movie` | `tmdb?`, `imdb?`, `ds_lang?`, `sub_url?`, `autoplay?` | `{ embed_url }` |
| `/embed/tv` | the movie params, plus `season?`, `episode?`, `autonext?` | `{ embed_url }` |
| `/latest/movies`, `/latest/tvshows` | `page` | Proxies `https://{domain}/{movies\|tvshows}/latest/page-{page}.json` unchanged. |
| `/movie/availability/{id}` | – | `{ available: bool, reason?, embed_url?, tmdb_id, type: "movie" }` |
| `/tv/availability/{id}` | `season?`, `episode?` | Same as the movie version with `type: "tv"`, plus `season` and `episode` when given. |

**Embed URL format.** The base is `https://{domain}/embed/{movie|tv}`.

How the URL is built:
- If there is an id, append `/{tmdb or imdb}`, with `tmdb` taking precedence.
- For TV, if both `season` and `episode` are given and there is an id, also append `/{season}/{episode}`.
- Add the remaining optional params (`ds_lang`, `sub_url`, `autoplay`, `autonext`) as a URL-encoded query string.
- When there is no id, `tmdb` and `imdb` go in the query string as well.

Examples:
- `https://vidsrc.sh/embed/movie/550`
- `https://vidsrc.sh/embed/tv/1399/1/2?autonext=1`
