import { jsonLdText, type JsonLd as JsonLdData } from '../lib/schema'

/** Inline structured data. Google reads JSON-LD anywhere in the rendered page. */
export default function JsonLd({ data }: { data: JsonLdData }) {
  // The text is JSON with `<` escaped (see jsonLdText), so it can't break out of the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />
}
