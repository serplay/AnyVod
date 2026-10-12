import { useEffect } from 'react'
import type { MediaKind } from '../api/types'

interface VideoSchemaProps {
  name?: string
  description?: string
  thumbnailUrl?: string
  uploadDate?: string
  /** Runtime in minutes; emitted as ISO 8601 (PT1H30M). */
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

function removeSchema() {
  document.querySelector('script[data-schema="video"]')?.remove()
}

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
    // Remove any existing video schema
    removeSchema()

    if (!name || !description || !thumbnailUrl) return

    // Build the base VideoObject
    const videoSchema: JsonLd = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      description: description.slice(0, 200), // Keep it concise
      thumbnailUrl,
      uploadDate: uploadDate || new Date().toISOString().split('T')[0],
    }

    // Add duration if available (convert minutes to ISO 8601)
    if (duration) {
      const hours = Math.floor(duration / 60)
      const minutes = duration % 60
      videoSchema.duration = hours > 0 ? `PT${hours}H${minutes}M` : `PT${minutes}M`
    }

    if (contentUrl) videoSchema.contentUrl = contentUrl
    if (embedUrl) videoSchema.embedUrl = embedUrl

    // For TV episodes, add episode-specific data
    if (type === 'tv' && seasonNumber && episodeNumber) {
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
                dateCreated: uploadDate,
              },
            ],
          }
        : videoSchema

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'video')
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)

    // Cleanup on unmount / change
    return removeSchema
  }, [name, description, thumbnailUrl, uploadDate, duration, contentUrl, embedUrl, type, seasonNumber, episodeNumber, seriesName])

  return null // This component doesn't render anything visible
}
