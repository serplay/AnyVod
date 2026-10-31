import { EMBED_BASE } from '../config'
import type { MediaKind } from '../api/types'

/**
 * The player iframe URL: `{base}/embed/movie/{id}` or `{base}/embed/tv/{id}/{season}/{episode}`.
 * Built here rather than fetched from `/vidsrc/embed/*`, so the player starts without
 * waiting on an API round trip. Mirrors `build_embed_url` in backend/src/vidsrc.rs.
 */
export function embedUrl(kind: MediaKind, id: number, season?: number, episode?: number, base: string = EMBED_BASE): string {
  const root = `${base.replace(/\/+$/, '')}/embed/${kind}/${encodeURIComponent(String(id))}`
  if (kind === 'tv' && season !== undefined && episode !== undefined) return `${root}/${season}/${episode}`
  return root
}
