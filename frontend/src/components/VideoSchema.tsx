import { useEffect } from 'react'
import type { MediaKind } from '../api/types'
import { formatIsoDuration } from '../lib/schema'

interface VideoSchemaProps {
  name?: string
  description?: string
  thumbnailUrl?: string
  /** Release date (YYYY-MM-DD); omitted from the schema when unknown. */
  uploadDate?: string
  /** Runtime in minutes; emitted as ISO 8601 (PT1H30M), omitted when unknown. */
  duration?: number | null
  /** URL to the actual video file (if available) */
  contentUrl?: string
  /** URL to the embed player */
  embedUrl?: string
  type?: MediaKind
  seasonNumber?: number
  episodeNumber?: number
  seriesName?: string
}

type JsonLd = Record<string, unknown>

/**
 * VideoSchema - Injects VideoObject structured data for SEO
 * Helps Google index video content and show rich snippets in search results
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/video
 */
export default function VideoSchema({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  contentUrl,
  embedUrl,
  type = 'movie',
  seasonNumber,
  episodeNumber,
  seriesName,
}: VideoSchemaProps) {
  useEffect(() => {
    if (!name || !description || !thumbnailUrl) return

    // Build the base VideoObject
    const videoSchema: JsonLd = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      description: description.slice(0, 200), // Keep it concise
      thumbnailUrl,
    }

    // Unknown values are omitted rather than faked.
    if (uploadDate) videoSchema.uploadDate = uploadDate
    const isoDuration = formatIsoDuration(duration)
    if (isoDuration) videoSchema.duration = isoDuration

    if (contentUrl) videoSchema.contentUrl = contentUrl
    if (embedUrl) videoSchema.embedUrl = embedUrl

    // For TV episodes, add episode-specific data
    if (type === 'tv' && seasonNumber != null && episodeNumber != null) {
      videoSchema['@type'] = 'TVEpisode'
      videoSchema.episodeNumber = episodeNumber
      videoSchema.partOfSeason = {
        '@type': 'TVSeason',
        seasonNumber,
        partOfSeries: {
          '@type': 'TVSeries',
          name: seriesName || name,
        },
      }
    }

    // For movies, combine VideoObject and Movie
    const schema: JsonLd =
      type === 'movie'
        ? {
            '@context': 'https://schema.org',
            '@graph': [
              videoSchema,
              {
                '@type': 'Movie',
                name,
                description: description.slice(0, 200),
                image: thumbnailUrl,
                ...(uploadDate ? { dateCreated: uploadDate } : {}),
              },
            ],
          }
        : videoSchema

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'video')
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)

    // Each instance removes exactly the script it added, on change and on unmount.
    return () => script.remove()
  }, [name, description, thumbnailUrl, uploadDate, duration, contentUrl, embedUrl, type, seasonNumber, episodeNumber, seriesName])

  return null // This component doesn't render anything visible
}
