import { embedUrl } from './embed'

describe('embedUrl', () => {
  it('builds movie and episode URLs', () => {
    expect(embedUrl('movie', 550, undefined, undefined, 'https://e.example/')).toBe('https://e.example/embed/movie/550')
    expect(embedUrl('tv', 1399, 2, 5, 'https://e.example')).toBe('https://e.example/embed/tv/1399/2/5')
  })

  it('ignores season/episode for movies and needs both for TV', () => {
    expect(embedUrl('movie', 1, 1, 1, 'https://e.example')).toBe('https://e.example/embed/movie/1')
    expect(embedUrl('tv', 7, 1, undefined, 'https://e.example')).toBe('https://e.example/embed/tv/7')
  })

  it('defaults to vidsrc.sh', () => {
    expect(embedUrl('movie', 2)).toBe('https://vidsrc.sh/embed/movie/2')
  })
})
