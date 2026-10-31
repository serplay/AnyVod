/** Site-wide constants. */
export const SITE_NAME = 'AnyVod'

export const CONTACT_EMAIL = 'infinity@losingsanity.com'
export const DISCORD_USER_ID = '1465142433162461226'
export const DISCORD_PROFILE_URL = `https://discord.com/users/${DISCORD_USER_ID}`

/** Public origin for canonical / Open Graph URLs (no trailing slash). Override with `VITE_SITE_URL`. */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL || 'https://vod.losingsanity.com').replace(/\/+$/, '')

export const DEFAULT_TITLE = `${SITE_NAME} - Free Movie and TV Show Streaming`

export const DEFAULT_DESCRIPTION =
  'Stream your favorite movies and TV shows for free. Discover trending films, popular series, and explore a vast library of entertainment content.'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

/**
 * Origin of the embed provider the player iframes load (no trailing slash). Override with
 * `VITE_EMBED_BASE`; keep the CSP `frame-src` in render.yaml and nginx.conf in step with it.
 */
export const EMBED_BASE: string = (import.meta.env.VITE_EMBED_BASE || 'https://vidsrc.sh').replace(/\/+$/, '')
