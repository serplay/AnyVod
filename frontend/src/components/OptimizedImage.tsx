import { memo, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { tmdbImageFor, tmdbSrcSet, type ImageRole, type ImageSize } from '../lib/media'

type ImgPassthrough = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'alt' | 'onLoad' | 'onError' | 'style' | 'className' | 'loading' | 'fetchPriority'
>

export interface OptimizedImageProps extends ImgPassthrough {
  src?: string
  alt?: string
  /** Class for the wrapper element. */
  className?: string
  placeholderSrc?: string
  tmdbPath?: string | null
  tmdbType?: ImageRole
  tmdbSize?: ImageSize
  /**
   * The `sizes` attribute for the srcset: the image's rendered width per
   * viewport (e.g. `"200px"`, `"100vw"`, `"(max-width: 480px) 50vw, 200px"`).
   */
  sizes?: string
  /** Above-the-fold image: loads eagerly with `fetchpriority="high"`. */
  priority?: boolean
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void
  onError?: (e: SyntheticEvent<HTMLImageElement>) => void
}

/**
 * Image with a placeholder, native lazy loading and a TMDB srcset.
 * Load/error state is tracked per source URL, so it resets when the path changes.
 */
const OptimizedImage = memo(function OptimizedImage({
  src,
  alt = '',
  className = '',
  placeholderSrc,
  tmdbPath,
  tmdbType = 'poster',
  tmdbSize = 'medium',
  sizes,
  priority = false,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const imageSrc = tmdbPath ? tmdbImageFor(tmdbPath, tmdbType, tmdbSize) : src
  const srcSet = tmdbPath ? tmdbSrcSet(tmdbPath, tmdbType) : undefined

  // Remember which URL loaded / failed: a new path is automatically "not loaded yet".
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined)
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined)
  const isLoaded = !!imageSrc && loadedSrc === imageSrc
  const hasError = !!imageSrc && failedSrc === imageSrc

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setLoadedSrc(imageSrc)
    onLoad?.(e)
  }

  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    setFailedSrc(imageSrc)
    onError?.(e)
  }

  const showPlaceholder = !isLoaded || hasError

  return (
    <div className={`optimized-image-wrapper ${className}`.trim()}>
      {showPlaceholder && (
        <div className="optimized-image-placeholder">
          {placeholderSrc ? (
            <img src={placeholderSrc} alt="" className="optimized-image-placeholder-img" />
          ) : (
            <div className="optimized-image-placeholder-icon" aria-hidden="true">
              🎬
            </div>
          )}
        </div>
      )}

      {imageSrc && !hasError && (
        <img
          {...props}
          src={imageSrc}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`optimized-image-img${isLoaded ? ' is-loaded' : ''}`}
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

/** Movie/show poster. */
export const PosterImage = memo(function PosterImage({ path, size = 'medium', className = '', ...props }: RoleImageProps) {
  return <OptimizedImage {...props} tmdbPath={path} tmdbType="poster" tmdbSize={size} className={`poster-image ${className}`} />
})

/** Cast/person profile photo. */
export const ProfileImage = memo(function ProfileImage({ path, size = 'medium', className = '', ...props }: RoleImageProps) {
  return <OptimizedImage {...props} tmdbPath={path} tmdbType="profile" tmdbSize={size} className={`profile-image ${className}`} />
})

/** Episode still. */
export const StillImage = memo(function StillImage({ path, size = 'medium', className = '', ...props }: RoleImageProps) {
  return <OptimizedImage {...props} tmdbPath={path} tmdbType="still" tmdbSize={size} className={`still-image ${className}`} />
})
