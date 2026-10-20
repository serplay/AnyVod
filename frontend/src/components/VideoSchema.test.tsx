import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import VideoSchema from './VideoSchema'

function schemaScripts() {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[data-schema="video"]'))
}

function readSchema(): Record<string, unknown> {
  const [script] = schemaScripts()
  if (!script) throw new Error('no schema script')
  return JSON.parse(script.textContent ?? '{}') as Record<string, unknown>
}

describe('VideoSchema', () => {
  it('emits an ISO 8601 duration and the known upload date', () => {
    const { unmount } = render(
      <VideoSchema type="tv" name="Show" description="desc" thumbnailUrl="https://x/y.jpg" duration={105} uploadDate="2020-01-02" seasonNumber={1} episodeNumber={2} />,
    )
    const schema = readSchema()
    expect(schema.duration).toBe('PT1H45M')
    expect(schema.uploadDate).toBe('2020-01-02')
    unmount()
  })

  it('omits unknown duration and upload date instead of faking them', () => {
    const { unmount } = render(<VideoSchema type="tv" name="Show" description="desc" thumbnailUrl="https://x/y.jpg" />)
    const schema = readSchema()
    expect(schema).not.toHaveProperty('duration')
    expect(schema).not.toHaveProperty('uploadDate')
    unmount()
  })

  it('removes its script on unmount', () => {
    const { unmount } = render(<VideoSchema name="Movie" description="desc" thumbnailUrl="https://x/y.jpg" duration={90} />)
    expect(schemaScripts()).toHaveLength(1)
    unmount()
    expect(schemaScripts()).toHaveLength(0)
  })
})
