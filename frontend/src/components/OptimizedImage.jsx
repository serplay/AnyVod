import React, { useState, useRef, useEffect, memo } from 'react'

/**
 * TMDB Image size configurations
 * Using smaller sizes for thumbnails, larger for detail views
 */
const TMDB_SIZES = {
  poster: {
    small: 'w185',     // ~185px - for small cards
    medium: 'w342',    // ~342px - for category cards
    large: 'w500',     // ~500px - for movie page posters
    original: 'original'
  },
  backdrop: {
    small: 'w300',     // ~300px - for thumbnails
    medium: 'w780',    // ~780px - for medium screens
    large: 'w1280',    // ~1280px - for large screens
    original: 'original'
  },
  profile: {
    small: 'w45',      // ~45px - for tiny avatars
    medium: 'w185',    // ~185px - for cast cards
    large: 'h632',     // ~632px height - for person page
    original: 'original'
  },
  still: {
    small: 'w185',     // ~185px
    medium: 'w300',    // ~300px - for episode thumbnails
    large: 'w500',     // ~500px
    original: 'original'
  }
}

/**
 * Get optimized TMDB image URL based on container size
 */
export function getTMDBImageUrl(path, type = 'poster', size = 'medium') {
  if (!path) return null
  const sizeConfig = TMDB_SIZES[type] || TMDB_SIZES.poster
  const sizeValue = sizeConfig[size] || sizeConfig.medium
  return `https://image.tmdb.org/t/p/${sizeValue}${path}.webp`
}

/**
 * Generate srcset for responsive images
 */
export function getTMDBSrcSet(path, type = 'poster') {
  if (!path) return ''
  const sizeConfig = TMDB_SIZES[type] || TMDB_SIZES.poster
  const sizes = Object.entries(sizeConfig)
    .filter(([key]) => key !== 'original')
    .map(([, value]) => {
      const width = parseInt(value.replace(/\D/g, '')) || 500
      return `https://image.tmdb.org/t/p/${value}${path}.webp ${width}w`
    })
  return sizes.join(', ')
}

/**
 * OptimizedImage component with lazy loading and progressive enhancement
 */
const OptimizedImage = memo(function OptimizedImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  placeholderSrc,
  tmdbPath,
  tmdbType = 'poster',
  tmdbSize = 'medium',
  priority = false, // Load immediately without lazy loading
  onLoad,
  onError,
  style,
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // Compute the actual image source
  const imageSrc = tmdbPath 
    ? getTMDBImageUrl(tmdbPath, tmdbType, tmdbSize)
    : src

  // Generate srcset for responsive loading
  const srcSet = tmdbPath ? getTMDBSrcSet(tmdbPath, tmdbType) : undefined

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) {
      setIsInView(true)
      return
    }

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true)
      return
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observerRef.current?.disconnect()
          }
        })
      },
      {
        rootMargin: '200px 800px', // 200px vertical, 800px horizontal for category rows
        threshold: 0.01
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [priority])

  const handleLoad = (e) => {
    setIsLoaded(true)
    onLoad?.(e)
  }

  const handleError = (e) => {
    setHasError(true)
    onError?.(e)
  }

  // Determine what to render
  const showPlaceholder = !isLoaded || hasError
  const shouldLoadImage = isInView && imageSrc && !hasError

  return (
    <div
      ref={imgRef}
      className={`optimized-image-wrapper ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: width || '100%',
        height: height || 'auto',
        ...style
      }}
    >
      {/* Placeholder/blur background */}
      {showPlaceholder && (
        <div
          className="optimized-image-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, var(--card, #3B1C32), var(--card-2, #6A1E55))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.5,
                filter: 'grayscale(0.3)'
              }}
            />
          ) : (
            <div style={{ 
              color: 'var(--muted, #d4a5c0)', 
              fontSize: '14px',
              opacity: 0.6 
            }}>
              🎬
            </div>
          )}
        </div>
      )}

      {/* Actual image */}
      {shouldLoadImage && (
        <img
          src={imageSrc}
          srcSet={srcSet}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
          {...props}
        />
      )}
    </div>
  )
})

export default OptimizedImage

/**
 * Specialized component for movie/show posters
 */
export const PosterImage = memo(function PosterImage({
  path,
  alt,
  size = 'medium',
  className = '',
  ...props
}) {
  return (
    <OptimizedImage
      tmdbPath={path}
      tmdbType="poster"
      tmdbSize={size}
      alt={alt}
      className={`poster-image ${className}`}
      {...props}
    />
  )
})

/**
 * Specialized component for backdrop images
 */
export const BackdropImage = memo(function BackdropImage({
  path,
  alt,
  size = 'large',
  className = '',
  priority = true, // Backdrops are usually above-the-fold
  ...props
}) {
  return (
    <OptimizedImage
      tmdbPath={path}
      tmdbType="backdrop"
      tmdbSize={size}
      alt={alt}
      className={`backdrop-image ${className}`}
      priority={priority}
      {...props}
    />
  )
})

/**
 * Specialized component for cast/person profile images
 */
export const ProfileImage = memo(function ProfileImage({
  path,
  alt,
  size = 'medium',
  className = '',
  ...props
}) {
  return (
    <OptimizedImage
      tmdbPath={path}
      tmdbType="profile"
      tmdbSize={size}
      alt={alt}
      className={`profile-image ${className}`}
      {...props}
    />
  )
})

/**
 * Specialized component for episode still images
 */
export const StillImage = memo(function StillImage({
  path,
  alt,
  size = 'medium',
  className = '',
  ...props
}) {
  return (
    <OptimizedImage
      tmdbPath={path}
      tmdbType="still"
      tmdbSize={size}
      alt={alt}
      className={`still-image ${className}`}
      {...props}
    />
  )
})
