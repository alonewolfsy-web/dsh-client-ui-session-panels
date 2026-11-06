/** Number formatting for the session panels. Ported from the session-cards card set. */

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

/** Whole percentage, the gauge's spelling: 94%, not 94.0%. */
export function fmtPercentInt(value: number | null | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(Math.min(Math.max(value, 0), 100))}%`
}

/** Token volume in millions — a fixed unit, so a small session still reads 0.49M. */
export function fmtMillions(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return `${(Math.max(0, value) / 1_000_000).toFixed(2)}M`
}

/** Decode throughput without the estimate tilde: 167 tok/s. */
export function fmtTps(tokens: number | undefined | null, ms: number | undefined | null): string {
  if (!tokens || !ms || !Number.isFinite(tokens) || !Number.isFinite(ms) || ms <= 0) return '—'
  const rate = tokens / (ms / 1000)
  if (!Number.isFinite(rate) || rate <= 0) return '—'
  return `${Math.round(rate)} tok/s`
}
