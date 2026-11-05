/** Number and time formatting for the session panels. Ported from the session-cards card set. */

/** Compact token count: 940, 12.3K, 1.05M. */
export function fmtTokens(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  const n = Math.max(0, value)
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k < 100 ? k.toFixed(1) : Math.round(k)}K`
  }
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** One-decimal percentage, capped so a runaway reading never widens the row. */
export function fmtPercent(value: number | null | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return `${Math.min(Math.max(value, 0), 999).toFixed(1)}%`
}

/** Duration as 840ms, 1.2s, 1m 12s. */
export function fmtDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
  // Round first, then split: rounding the remainder alone can carry it to 60
  // and print "1m 60s". 119700ms rounds to 120s → "2m 0s".
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}m ${total % 60}s`
}

/** Decode throughput, the readout openchamber labels "~41 tok/s". */
export function fmtRate(tokens: number | undefined | null, ms: number | undefined | null): string {
  if (!tokens || !ms || !Number.isFinite(tokens) || !Number.isFinite(ms) || ms <= 0) return '—'
  const rate = tokens / (ms / 1000)
  if (!Number.isFinite(rate) || rate <= 0) return '—'
  return `~${Math.round(rate)} tok/s`
}
