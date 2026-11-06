/**
 * Card layout: which sections exist, their order, and which are hidden.
 *
 * The pane unmounts on session switches and tab moves, so this lives in
 * localStorage rather than component state — the user's arrangement survives.
 */

export const CARD_IDS = ['gauge', 'skills', 'mcp'] as const
export type CardId = (typeof CARD_IDS)[number]

/**
 * Ids an earlier version stored. `context` was the readout card; the gauge that
 * replaced it keeps the slot but starts visible — it is a new card, so an old
 * "hidden" flag for the card it replaced must not keep it out of sight. Any
 * other retired id (`turns`) simply drops out: no card claims its slot.
 */
const LEGACY_IDS: Record<string, CardId> = { context: 'gauge' }

export interface CardLayout {
  /** Every known card id, in display order. */
  order: CardId[]
  /** Card ids the user switched off. */
  hidden: CardId[]
}

const STORAGE_KEY = 'dsh.sessionPanels.layout.v1'

const DEFAULT_LAYOUT: CardLayout = { order: [...CARD_IDS], hidden: [] }

function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && (CARD_IDS as readonly string[]).includes(value)
}

/** Drop unknown ids and append cards added by a later version, so an old save never hides new work. */
function normalize(raw: unknown): CardLayout {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] }
  const record = raw as { order?: unknown; hidden?: unknown }
  const seen = new Set<CardId>()
  const order: CardId[] = []
  if (Array.isArray(record.order)) {
    for (const entry of record.order) {
      const id = typeof entry === 'string' ? (LEGACY_IDS[entry] ?? entry) : entry
      if (isCardId(id) && !seen.has(id)) {
        seen.add(id)
        order.push(id)
      }
    }
  }
  for (const id of CARD_IDS) if (!seen.has(id)) order.push(id)
  // Legacy ids fail `isCardId`, so a stale hidden flag dies with the id it named.
  const hidden = Array.isArray(record.hidden) ? record.hidden.filter(isCardId) : []
  return { order, hidden }
}

export function readLayout(): CardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return normalize(undefined)
    return normalize(JSON.parse(raw))
  } catch {
    return normalize(undefined)
  }
}

export function writeLayout(layout: CardLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* storage unavailable: the arrangement still applies for this mount */
  }
}

/** Move one card to another position, keeping every id exactly once. */
export function moveCard(order: CardId[], from: CardId, to: CardId): CardId[] {
  if (from === to) return order
  const next = order.filter((id) => id !== from)
  const at = next.indexOf(to)
  if (at < 0) return order
  next.splice(at, 0, from)
  return next
}

/**
 * Move one card relative to a target: before it, or after it — what the
 * title-bar drag computes from the pointer's half over the target card.
 * Dropping "after" the last card lands the dragged one at the end.
 */
export function moveCardRelative(order: CardId[], from: CardId, to: CardId, side: 'before' | 'after'): CardId[] {
  if (from === to) return order
  const rest = order.filter((id) => id !== from)
  const at = rest.indexOf(to)
  if (at < 0) return order
  return side === 'before' ? [...rest.slice(0, at), from, ...rest.slice(at)] : [...rest.slice(0, at + 1), from, ...rest.slice(at + 1)]
}
