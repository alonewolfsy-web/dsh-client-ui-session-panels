/**
 * Projection metrics: the shapes the host composes into the body's
 * `useProjection` reads, and the derived figures the context card shows.
 *
 * The cache-hit figure is a port of openchamber's `computeCacheHitRate`
 * (its `tokenUtils` store helper): the read share of everything
 * the prompt path touched — uncached input, cache reads and cache writes —
 * clamped to [0, 100]. The DSH `tokenUsage` projection carries the same three
 * numbers under different names; only the field names are re-spelled here.
 *
 * The segment bar is the DSH-native replacement for openchamber's
 * character-estimate walk (`contextBreakdown.ts`): the host already projects
 * the window split into system / tools / messages, so the panel renders that
 * truth directly instead of re-estimating it from message text.
 */

/** Measured and projected pressure on the model's context window. */
export interface ContextPressure {
  pressureTokens?: number
  projectedTokens?: number
  contextWindow?: number
}

/** One turn's final round-trip, as the host reports it. */
export interface TokenUsage {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** Cumulative turn statistics for the session. */
export interface SessionStats {
  turns?: number
  steps?: number
  llmMs?: number
  toolMs?: number
  ttftMs?: number
  ttftSteps?: number
  decodeMs?: number
  decodeTokens?: number
}

/** The host's own split of what the window holds. */
export interface ContextBreakdown {
  systemTokens?: number
  toolsTokens?: number
  messageTokens?: number
}

/** The cache-hit figure, with a flag distinguishing "no input yet" from 0%. */
export interface CacheHit {
  percent: number
  hasInput: boolean
}

/**
 * The read share of the prompt path: cache reads over everything the path
 * touched. `hasInput` is false while no input has flowed at all, so the panel
 * shows "—" instead of a lying 0%.
 *
 * Ported from openchamber's `computeCacheHitRate`; the clamp keeps a
 * runaway read from ever reading above 100%.
 */
export function computeCacheHit(usage: TokenUsage | null | undefined): CacheHit {
  if (!usage || typeof usage !== 'object') return { percent: 0, hasInput: false }

  const input = usage.uncachedInputTokens ?? 0
  const read = usage.cacheReadTokens ?? 0
  const write = usage.cacheWriteTokens ?? 0
  const total = input + read + write

  if (total <= 0) return { percent: 0, hasInput: false }

  const safeRead = Math.max(0, read)
  const percent = Math.min(100, Math.max(0, (safeRead / total) * 100))
  return { percent, hasInput: true }
}

/** The four segments of the context bar, as absolute token counts. */
export interface BarSegments {
  system: number
  tools: number
  messages: number
  /** The genuine remainder of the window: the free space the user still has. */
  free: number
  /** The denominator every segment is a share of. */
  total: number
}

/**
 * The bar's segments, as shares of the window.
 *
 * The window is the denominator for every segment, and `free` is what is left.
 * When the window is unknown the split becomes its own denominator, and when
 * the split runs past the window the total grows to hold it so no segment can
 * exceed the bar. Returns `null` when there is nothing at all to draw.
 */
export function contextSegments(
  pressure: ContextPressure | null | undefined,
  breakdown: ContextBreakdown | null | undefined,
): BarSegments | null {
  const system = nonNeg(breakdown?.systemTokens)
  const tools = nonNeg(breakdown?.toolsTokens)
  const messages = nonNeg(breakdown?.messageTokens)
  const window = nonNeg(pressure?.contextWindow)
  const used = system + tools + messages

  if (used <= 0 && window <= 0) return null

  const total = Math.max(used, window)
  return { system, tools, messages, free: total - used, total }
}

/** The measured pressure as a share of the window, or `null` without a window. */
export function pressurePercent(pressure: ContextPressure | null | undefined): number | null {
  const measured = pressure?.pressureTokens
  const window = pressure?.contextWindow
  if (
    typeof measured !== 'number' ||
    !Number.isFinite(measured) ||
    typeof window !== 'number' ||
    !Number.isFinite(window) ||
    window <= 0
  ) {
    return null
  }
  return Math.min(100, Math.max(0, (Math.max(0, measured) / window) * 100))
}

function nonNeg(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}
