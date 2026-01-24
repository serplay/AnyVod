import { useEffect } from 'react'

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
  duration,     // ISO 8601 format: PT1H30M (1h 30m)
  contentUrl,   // URL to the actual video file (if available)
  embedUrl,     // URL to the embed player
  type = 'movie', // 'movie' or 'tv'
  seasonNumber,
  episodeNumber,
  seriesName,
}) {
  useEffect(() => {
    // Remove any existing video schema
    const existingSchema = document.querySelector('script[data-schema="video"]')
    if (existingSchema) {
      existingSchema.remove()
    }

    if (!name || !description || !thumbnailUrl) return

    // Build the base VideoObject
    const videoSchema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: name,
      description: description.slice(0, 200), // Keep it concise
      thumbnailUrl: thumbnailUrl,
      uploadDate: uploadDate || new Date().toISOString().split('T')[0],
    }

    // Add duration if available (convert minutes to ISO 8601)
    if (duration) {
      const hours = Math.floor(duration / 60)
      const minutes = duration % 60
      videoSchema.duration = hours > 0 ? `PT${hours}H${minutes}M` : `PT${minutes}M`
    }

    // Add content/embed URLs if available
    if (contentUrl) {
      videoSchema.contentUrl = contentUrl
    }
    if (embedUrl) {
      videoSchema.embedUrl = embedUrl
    }

    // For TV episodes, add episode-specific data
    if (type === 'tv' && seasonNumber && episodeNumber) {
      videoSchema['@type'] = 'TVEpisode'
      videoSchema.episodeNumber = episodeNumber
      videoSchema.partOfSeason = {
        '@type': 'TVSeason',
        seasonNumber: seasonNumber,
        partOfSeries: {
          '@type': 'TVSeries',
          name: seriesName || name
        }
      }
    }

    // For movies, add Movie type
    if (type === 'movie') {
      // Create a combined schema with both VideoObject and Movie
      const combinedSchema = {
        '@context': 'https://schema.org',
        '@graph': [
          videoSchema,
          {
            '@type': 'Movie',
            name: name,
            description: description.slice(0, 200),
            image: thumbnailUrl,
            dateCreated: uploadDate,
          }
        ]
      }
      
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-schema', 'video')
      script.textContent = JSON.stringify(combinedSchema)
      document.head.appendChild(script)
      return
    }

    // Inject the schema
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', 'video')
    script.textContent = JSON.stringify(videoSchema)
    document.head.appendChild(script)

    // Cleanup on unmount
    return () => {
      const schema = document.querySelector('script[data-schema="video"]')
      if (schema) {
        schema.remove()
      }
    }
  }, [name, description, thumbnailUrl, uploadDate, duration, contentUrl, embedUrl, type, seasonNumber, episodeNumber, seriesName])

  return null // This component doesn't render anything visible
}
