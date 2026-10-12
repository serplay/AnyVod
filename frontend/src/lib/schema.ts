/**
 * Runtime in minutes -> ISO 8601 duration (`105` -> `PT1H45M`, `120` -> `PT2H`, `45` -> `PT45M`).
 * Returns undefined when the runtime is unknown (null/undefined/non-positive/non-finite),
 * so callers can omit the property instead of emitting a bogus value.
 */
export function formatIsoDuration(minutes: number | null | undefined): string | undefined {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return undefined
  const total = Math.round(minutes)
  if (total <= 0) return undefined
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `PT${hours > 0 ? `${hours}H` : ''}${mins > 0 ? `${mins}M` : ''}`
}
