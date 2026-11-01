import { describe, expect, it } from 'vitest'
import { personSeoDescription, titleSeoDescription, titleSeoTitle, titleWithYear } from './seoText'

describe('seoText', () => {
  it('builds titles with the year when known', () => {
    expect(titleWithYear('movie', { title: 'Heat', release_date: '1995-12-15' })).toBe('Heat (1995)')
    expect(titleWithYear('tv', { name: 'Dark', first_air_date: '' })).toBe('Dark')
    expect(titleSeoTitle('tv', { name: 'Dark', first_air_date: '2017-12-01' })).toBe('Dark (2017) - Watch TV Show Online')
  })

  it('leads the description with what the title is, within 155 chars', () => {
    const d = titleSeoDescription('movie', {
      title: 'Heat',
      release_date: '1995-12-15',
      genres: [{ name: 'Crime' }, { name: 'Drama' }],
      overview: 'Obsessive master thief Neil McCauley leads a top-notch crew '.repeat(5),
    })
    expect(d.startsWith('Heat (1995) · Crime, Drama. Obsessive')).toBe(true)
    expect(d.length).toBeLessThanOrEqual(155)
    expect(titleSeoDescription('movie', { title: 'X' })).toBe('X. Watch it online on AnyVod.')
  })

  it('describes people by role', () => {
    expect(personSeoDescription({ name: 'Al Pacino', known_for_department: 'Acting', biography: 'Born in NYC.' })).toBe(
      'Al Pacino · Actor. Born in NYC.',
    )
  })
})
