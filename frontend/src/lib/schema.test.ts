import { describe, expect, it } from 'vitest'
import { formatIsoDuration } from './schema'

describe('formatIsoDuration', () => {
  it('formats hours and minutes as ISO 8601', () => {
    expect(formatIsoDuration(105)).toBe('PT1H45M')
    expect(formatIsoDuration(45)).toBe('PT45M')
    expect(formatIsoDuration(120)).toBe('PT2H')
    expect(formatIsoDuration(61)).toBe('PT1H1M')
  })

  it('rounds fractional minutes', () => {
    expect(formatIsoDuration(44.6)).toBe('PT45M')
  })

  it('returns undefined when unknown', () => {
    expect(formatIsoDuration(undefined)).toBeUndefined()
    expect(formatIsoDuration(null)).toBeUndefined()
    expect(formatIsoDuration(0)).toBeUndefined()
    expect(formatIsoDuration(-5)).toBeUndefined()
    expect(formatIsoDuration(Number.NaN)).toBeUndefined()
  })
})
