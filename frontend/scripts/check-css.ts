/**
 * Guards the design system: fails when a stylesheet bypasses the tokens.
 *
 *   npm run lint:css
 *
 * Outside src/styles/tokens.css, CSS may not contain raw colours (hex, rgb(),
 * hsl()), gradients, text-shadow or backdrop-filter, and box-shadow only as
 * var(--shadow-float) (menus and sheets, the things that float).
 * Inline SVG data URIs are skipped (their fill/stroke colours are not UI colours).
 *
 * Zero dependencies: runs on Node 22 with `--experimental-strip-types`.
 */
import { readdir, readFile } from 'node:fs/promises'

const STYLES = new URL('../src/styles/', import.meta.url)
const TOKENS = 'tokens.css'

const RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'raw colour (use a token)', pattern: /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i },
  { name: 'gradient (use a --scrim token)', pattern: /\b(?:linear|radial|conic)-gradient\(/i },
  { name: 'text-shadow', pattern: /\btext-shadow\s*:/i },
  { name: 'backdrop-filter (no glass)', pattern: /\bbackdrop-filter\s*:/i },
  { name: 'box-shadow on something at rest', pattern: /\bbox-shadow\s*:(?!\s*(?:var\(--shadow-float\)|inset\b|none\b))/i },
]

const files = (await readdir(STYLES)).filter((f) => f.endsWith('.css') && f !== TOKENS)
const problems: string[] = []

for (const file of files) {
  const lines = (await readFile(new URL(file, STYLES), 'utf8')).split('\n')
  lines.forEach((raw, i) => {
    // Drop comments and data URIs before matching.
    const line = raw.replace(/\/\*.*?\*\//g, '').replace(/url\((["'])data:.*?\1\)/g, 'url()')
    for (const rule of RULES) {
      if (rule.pattern.test(line)) problems.push(`src/styles/${file}:${i + 1}  ${rule.name}\n    ${raw.trim()}`)
    }
  })
}

if (problems.length > 0) {
  console.error(`check-css: ${problems.length} problem(s)\n\n${problems.join('\n')}`)
  process.exit(1)
}
console.log(`check-css: ${files.length} stylesheets use tokens only`)
