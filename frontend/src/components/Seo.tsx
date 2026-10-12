import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME } from '../config'
import { canonicalUrl } from '../lib/seo'

export type SeoType = 'website' | 'video.movie' | 'video.tv_show' | 'profile'

interface SeoProps {
  title: string
  description?: string
  /** Route path of the canonical page (e.g. `/movie/123`); resolved against `SITE_URL`. */
  path: string
  /** Absolute image URL; defaults to the site OG image. */
  image?: string
  type?: SeoType
  noindex?: boolean
}

const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
const NOINDEX_ROBOTS = 'noindex, follow'

/**
 * Per-page head tags. Relies on React 19 hoisting `<title>`, `<meta>` and
 * `<link>` into `document.head`; they are removed again when the page unmounts.
 * index.html therefore must not carry any of these tags (React does not dedupe).
 */
export default function Seo({ title, description, path, image, type = 'website', noindex = false }: SeoProps) {
  const desc = description || DEFAULT_DESCRIPTION
  const url = canonicalUrl(path)
  const img = image || DEFAULT_OG_IMAGE
  const fullTitle = title === SITE_NAME || title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={noindex ? NOINDEX_ROBOTS : INDEX_ROBOTS} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content={type} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
    </>
  )
}
