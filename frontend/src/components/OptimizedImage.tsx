import { useState, useRef, useEffect, memo, type CSSProperties, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { tmdbImageFor, tmdbSrcSet, type ImageRole, type ImageSize } from '../lib/media'

type ImgPassthrough = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height' | 'onLoad' | 'onError' | 'style' | 'className'>

export interface OptimizedImageProps extends ImgPassthrough {
  src?: string
  alt?: string
  className?: string
  width?: number | string
  height?: number | string
  placeholderSrc?: string
  tmdbPath?: string | null
  tmdbType?: ImageRole
  tmdbSize?: ImageSize
  /** Load immediately without lazy loading */
  priority?: boolean
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void
  onError?: (e: SyntheticEvent<HTMLImageElement>) => void
  style?: CSSProperties
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
  priority = false,
  onLoad,
  onError,
  style,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  // Compute the actual image source
  const imageSrc = tmdbPath ? tmdbImageFor(tmdbPath, tmdbType, tmdbSize) : src

  // Generate srcset for responsive loading
  const srcSet = tmdbPath ? tmdbSrcSet(tmdbPath, tmdbType) : undefined

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    const el = imgRef.current
    if (priority || !el || !('IntersectionObserver' in window)) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '200px 800px', // 200px vertical, 800px horizontal for category rows
        threshold: 0.01,
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [priority])

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true)
    onLoad?.(e)
  }

  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    setHasError(true)
    onError?.(e)
  }

  // Determine what to render
  const showPlaceholder = !isLoaded || hasError
  const shouldLoadImage = isInView && !!imageSrc && !hasError

  return (
    <div
      ref={imgRef}
      className={`optimized-image-wrapper ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: width || '100%',
        height: height || 'auto',
        ...style,
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
                filter: 'grayscale(0.3)',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                color: 'var(--muted, #d4a5c0)',
                fontSize: '14px',
                opacity: 0.6,
              }}
            >
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

interface RoleImageProps extends Omit<OptimizedImageProps, 'tmdbPath' | 'tmdbType' | 'tmdbSize'> {
  path: string | null | undefined
  size?: ImageSize
}

/**
 * Specialized component for movie/show posters
 */
export const PosterImage = memo(function PosterImage({ path, alt, size = 'medium', className = '', ...props }: RoleImageProps) {
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
}: RoleImageProps) {
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
export const ProfileImage = memo(function ProfileImage({ path, alt, size = 'medium', className = '', ...props }: RoleImageProps) {
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
export const StillImage = memo(function StillImage({ path, alt, size = 'medium', className = '', ...props }: RoleImageProps) {
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
