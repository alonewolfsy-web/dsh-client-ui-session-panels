/**
 * The panel body: what the right-sidebar tab draws.
 *
 * Every number is a host projection value read through `useProjection`; the one
 * derived family of figures — cache hit rate and the window's segment bar — is
 * computed in `metrics.ts` from those same projections. The context card
 * renders the host's own split of the window (system / tools / messages) and
 * adds what openchamber's panel computed by hand: the cache read share.
 *
 * The two activity sections are not projections. Skills fold the session's
 * event stream, because "what is running right now" is never stored as a value
 * anyone can read. MCP servers are host objects with no Remote namespace at
 * all, so the MCP section reads the same-origin status route its host half
 * publishes — and the switch on each row is the only control in this plugin
 * that changes host state.
 *
 * Sections are data, not markup: the order and the visible set live in
 * `layout.ts`, so the same body renders in play mode and in manage mode.
 */
import * as React from 'react'
import { fmtMillions, fmtPercentInt, fmtTokens, fmtTps } from './format'
import {
  fetchMcpServers,
  reconnectMcpServer,
  watchSessionActivity,
  NO_ACTIVITY,
  type Activity,
  type ClientContext,
  type McpServer,
} from './folds'
import { BoltIcon, DonutIcon, ServerIcon } from './icons'
import { type CardId, type CardLayout, moveCard, moveCardRelative, readLayout, writeLayout } from './layout'
import { computeCacheHit, pressurePercent } from './metrics'
import {
  CollapsibleSection,
  type DragProps,
  type HeaderDragProps,
  Empty,
  Meter,
} from './primitives'
import { ensureStyles } from './styles'

type Translator = (key: string, params?: Record<string, unknown>) => string
type ProjectionReader = ((key: string) => any) & ((key: string, selector: (value: any) => any) => any)

/** Props the slot framework composes for a session-scoped tab body. */
export interface SessionPanelsProps {
  sessionId: string
  useProjection: ProjectionReader
  t: Translator
  /**
   * The client root context, handed over by the plugin entry.
   *
   * Only the activity sections need it: the skills section follows the
   * session's event stream, which no projection exposes.
   */
  client?: ClientContext
  /**
   * Activity to show as in flight, for server-side rendering and previews.
   *
   * Effects never run under `renderToStaticMarkup`, so without this the skills
   * section could only ever be asserted as empty. Production omits it and the
   * section follows the stream.
   */
  initialActivity?: Activity
  /** MCP servers to show, under the same rule as `initialActivity`. */
  initialServers?: McpServer[]
}

/** Segment colours, host-token backed so both themes follow the app. */
const SEGMENT_COLORS = {
  system: 'var(--dsw-alias-label-tertiary, #8a8f98)',
  tools: 'var(--dsw-alias-state-warn-primary, #d9982b)',
  messages: 'var(--dsw-alias-brand-primary, #4d6bfe)',
}

/** Subscribe to the session's event stream and reduce it to work in flight. */
function useSessionActivity(
  client: ClientContext | undefined,
  sessionId: string,
  initial: Activity | undefined,
): Activity {
  const [activity, setActivity] = React.useState<Activity>(initial ?? NO_ACTIVITY)

  React.useEffect(() => {
    if (!sessionId) return
    // A new session (or a new stream) starts empty; the opening snapshot
    // re-seeds it within a tick. Without this reset the previous session's
    // "running" rows linger until the next snapshot — or forever when the
    // follow never comes up.
    setActivity(initial ?? NO_ACTIVITY)
    const controller = new AbortController()
    // The fold returns the same array when nothing moved, so a quiet stream
    // never re-renders the body.
    // Late frames from a host that drains its queue after the abort must not
    // overwrite the next session's freshly reset state.
    watchSessionActivity(client, sessionId, controller.signal, (a) => {
      if (!controller.signal.aborted) setActivity(a)
    }).catch(() => {
      /* no host session remote (or the tab outlived the stream): sections read empty */
    })
    return () => controller.abort()
  }, [client, sessionId])

  return activity
}

/** MCP rows from this plugin's host half, plus the reconnect action. */
function useMcpServers(initial: McpServer[] | undefined): {
  servers: McpServer[]
  failed: boolean
  busy: string | null
  reconnect: (id: string) => Promise<void>
} {
  const [state, setState] = React.useState<{ servers: McpServer[]; failed: boolean }>(
    initial && initial.length > 0 ? { servers: initial, failed: false } : { servers: [], failed: false },
  )
  const [busy, setBusy] = React.useState<string | null>(null)

  React.useEffect(() => {
    let live = true
    fetchMcpServers(undefined)
      .then((servers) => {
        if (live) setState({ servers, failed: false })
      })
      .catch(() => {
        if (live) setState({ servers: [], failed: true })
      })
    return () => {
      live = false
    }
  }, [])

  const reconnect = React.useCallback(async (id: string) => {
    setBusy(id)
    try {
      const servers = await reconnectMcpServer(undefined, id)
      setState({ servers, failed: false })
    } catch {
      /* keep the last snapshot; the row still shows its previous truth */
    } finally {
      setBusy(null)
    }
  }, [])

  return { ...state, busy, reconnect }
}

/** Dot tone for one server row: green known-good, amber maybe, red no. */
function toneOf(server: McpServer): 'live' | 'warn' | 'error' | 'idle' {
  if (server.connected) return 'live'
  if (server.state === 'active') return 'warn'
  if (server.state === 'failed' || server.state === 'error') return 'error'
  return 'idle'
}

/** Legend figures carry a tilde: the split is an estimate, the total is not. */
function approx(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `~${fmtTokens(value)}` : '—'
}

/** What the session has moved through the model: uncached input + cache read + output. */
function totalTokens(usage: Record<string, unknown> | null | undefined): number | undefined {
  if (!usage) return undefined
  const parts = ['uncachedInputTokens', 'cacheReadTokens', 'outputTokens'].map((key) => {
    const value = usage[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  })
  if (parts.every((value) => value === null)) return undefined
  return parts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

/** Average first-token latency in seconds, the popover's own wording: 3.2 秒. */
function avgFirstToken(stats: { ttftMs?: number; ttftSteps?: number } | undefined, t: Translator): string {
  if (!stats?.ttftMs || !stats.ttftSteps) return '—'
  return `${(stats.ttftMs / stats.ttftSteps / 1000).toFixed(1)}${t('unit.seconds')}`
}

/** One labelled figure of the context gauge: caption above, value below. */
const GaugeCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="osp-cell">
    <span className="osp-cell-label" title={label}>
      {label}
    </span>
    <span className="osp-cell-value">{value}</span>
  </div>
)

/** The root the panel lives in: the document, or the shadow root a host may isolate it in. */
function rootOf(node: Element | null): Document | ShadowRoot {
  const root = node?.getRootNode()
  return root && root.nodeType === 11 ? (root as ShadowRoot) : document
}

/** elementFromPoint, descending through shadow boundaries the host may have. */
function pointAt(x: number, y: number): Element | null {
  let el = document.elementFromPoint(x, y)
  while (el?.shadowRoot) {
    const inner = el.shadowRoot.elementFromPoint(x, y)
    if (!inner || inner === el) break
    el = inner
  }
  return el
}

/**
 * The panel body.
 *
 * Section order and visibility come from the persisted layout; every card
 * renders inside a slot that names it (`data-card-id`), which is what the
 * title-bar drag matches against. Manage mode swaps the bar for a grip plus a
 * visibility switch; play mode lets the bar itself be dragged.
 */
export const SessionPanelsBody: React.FC<SessionPanelsProps> = (props) => {
  const { useProjection, t, sessionId, client, initialActivity, initialServers } = props
  const cardRef = React.useRef<HTMLDivElement | null>(null)

  // Styles must exist before the first paint and must land in the root the
  // panel renders in. A ref callback runs with the node already attached — an
  // insertion effect would be too early to read the root, and a host that
  // isolates extension UI in a shadow root never sees document.head.
  const attachCard = React.useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node
    if (node) ensureStyles(node)
  }, [])

  const pressure = useProjection('contextPressure')
  const usage = useProjection('tokenUsage')
  const stats = useProjection('sessionStats')
  const breakdown = useProjection('contextBreakdown')

  const activity = useSessionActivity(client, sessionId, initialActivity)
  const mcp = useMcpServers(initialServers)

  const [layout, setLayout] = React.useState<CardLayout>(readLayout)
  const [manage, setManage] = React.useState(false)
  const [dragging, setDragging] = React.useState<CardId | null>(null)
  const [dropTarget, setDropTarget] = React.useState<CardId | null>(null)
  /** Which half of the target the pointer is over — that is the insertion point. */
  const [dropSide, setDropSide] = React.useState<'before' | 'after' | null>(null)
  /** The card being pointer-dragged, dimmed in place under the ghost. */
  const [lift, setLift] = React.useState<CardId | null>(null)

  /** Pointer-drag bookkeeping; React state only carries the render flags. */
  const pointerDrag = React.useRef<{ id: CardId; x: number; y: number; active: boolean } | null>(null)
  const dropRef = React.useRef<CardId | null>(null)
  const sideRef = React.useRef<'before' | 'after' | null>(null)
  /** The floating clone that follows the pointer while a drag is armed. */
  const ghostRef = React.useRef<HTMLElement | null>(null)
  /** Set when a pointer drag just ended, so the trailing click must not fold. */
  const swallowClick = React.useRef(false)

  const toggleHidden = React.useCallback((id: CardId) => {
    setLayout((current) => {
      const hidden = current.hidden.includes(id)
        ? current.hidden.filter((entry) => entry !== id)
        : [...current.hidden, id]
      const next = { ...current, hidden }
      writeLayout(next)
      return next
    })
  }, [])

  /** One move, both for the manage-mode drop and the title-bar pointer drop. */
  const commitMove = React.useCallback((from: CardId, to: CardId) => {
    setLayout((current) => {
      const next = { ...current, order: moveCard(current.order, from, to) }
      writeLayout(next)
      return next
    })
  }, [])

  /** Title-bar drops know which half the pointer was over, so they can land after the target too. */
  const commitMoveRelative = React.useCallback((from: CardId, to: CardId, side: 'before' | 'after') => {
    setLayout((current) => {
      const next = { ...current, order: moveCardRelative(current.order, from, to, side) }
      writeLayout(next)
      return next
    })
  }, [])

  /** Remove the ghost and the lifted look; shared by every drag ending. */
  const clearGhost = React.useCallback(() => {
    ghostRef.current?.remove()
    ghostRef.current = null
    setLift(null)
  }, [])

  // Unmount mid-drag (session switch, tab close) never runs the pointer
  // handlers, so clearGhost alone would strand the ghost on document.body.
  React.useEffect(
    () => () => {
      ghostRef.current?.remove()
      ghostRef.current = null
    },
    [],
  )

  /** Consume the post-drag click guard; shared by every card's toggle. */
  const toggleGuard = React.useCallback(() => {
    const swallowed = swallowClick.current
    swallowClick.current = false
    return swallowed
  }, [])

  /**
   * Title-bar pointer drag: press → move ≥6px arms the drag → a ghost of the
   * title bar follows the pointer while the original dims in place → the half
   * of the card under the pointer names the insertion point (drawn as a line
   * in the gap) → release commits the move. Pointer capture is taken only once
   * armed: capturing on the press would retarget the trailing click to the bar
   * and kill the fold chevron; a release under the threshold never armed, so
   * the click folds as usual.
   */
  const headerDragOf = React.useCallback(
    (id: CardId): HeaderDragProps => ({
      dragging: dragging === id,
      onPointerDown: (event) => {
        if (event.button !== 0) return
        swallowClick.current = false
        pointerDrag.current = { id, x: event.clientX, y: event.clientY, active: false }
      },
      onPointerMove: (event) => {
        const state = pointerDrag.current
        if (!state || state.id !== id) return
        if (!state.active) {
          const dx = event.clientX - state.x
          const dy = event.clientY - state.y
          if (dx * dx + dy * dy < 36) return
          state.active = true
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* capture unsupported: moves still land while the pointer stays inside */
          }
          // The ghost carries the title bar only — the folded card, not a
          // full-height preview. It is cloned before React re-renders the
          // dragging look, and any leftover drop state is stripped so the
          // carried bar never reads as a landing marker.
          const bar = event.currentTarget
          const rect = bar.getBoundingClientRect()
          const ghost = document.createElement('div')
          ghost.className = 'osp-ghost'
          const carried = bar.cloneNode(true) as HTMLElement
          carried.removeAttribute('data-dragging')
          carried.removeAttribute('data-drop')
          carried.style.marginBottom = '0'
          ghost.appendChild(carried)
          if (rect.width > 0) {
            ghost.style.left = `${rect.left}px`
            ghost.style.top = `${rect.top}px`
            ghost.style.width = `${rect.width}px`
          }
          // The ghost lives in the panel's own root: inside a shadow root the
          // document body would drop the host's styles and the carried bar
          // would arrive unformatted.
          const host = rootOf(cardRef.current)
          if (host.nodeType === 11) host.appendChild(ghost)
          else document.body.appendChild(ghost)
          ghostRef.current = ghost
          setDragging(id)
          setLift(id)
        }
        // Follow: pure transform, so the ghost tracks the pointer 1:1.
        const ghost = ghostRef.current
        if (ghost) {
          ghost.style.transform = `translate(${event.clientX - state.x}px, ${event.clientY - state.y}px)`
        }
        const under = pointAt(event.clientX, event.clientY)
        const slot = under?.closest('[data-card-id]')
        const raw = slot?.getAttribute('data-card-id') ?? null
        const target =
          raw !== null && raw !== id && !layout.hidden.includes(raw as CardId) ? (raw as CardId) : null
        // The insertion point is the half of the target the pointer is over.
        let side: 'before' | 'after' | null = null
        if (target) {
          const rect = slot?.querySelector<HTMLElement>('.osp-section')?.getBoundingClientRect()
          const mid = rect && rect.height > 0 ? rect.top + rect.height / 2 : null
          side = mid === null ? 'before' : event.clientY >= mid ? 'after' : 'before'
        }
        dropRef.current = target
        sideRef.current = side
        setDropTarget(target)
        setDropSide(side)
      },
      onPointerUp: (event) => {
        const state = pointerDrag.current
        pointerDrag.current = null
        if (state?.active) {
          swallowClick.current = true
          const target = dropRef.current
          const side = sideRef.current
          if (target && side) commitMoveRelative(id, target, side)
          try {
            event.currentTarget.releasePointerCapture(event.pointerId)
          } catch {
            /* capture already released with the pointer */
          }
        }
        dropRef.current = null
        sideRef.current = null
        clearGhost()
        setDragging(null)
        setDropTarget(null)
        setDropSide(null)
      },
      onPointerCancel: () => {
        pointerDrag.current = null
        dropRef.current = null
        sideRef.current = null
        clearGhost()
        setDragging(null)
        setDropTarget(null)
        setDropSide(null)
      },
    }),
    [dragging, layout.hidden, commitMoveRelative, clearGhost],
  )

  const dragPropsOf = React.useCallback(
    (id: CardId): DragProps => ({
      draggable: true,
      dragging: dragging === id,
      onDragStart: () => setDragging(id),
      onDragOver: (event: React.DragEvent) => {
        if (dragging !== null && dragging !== id) event.preventDefault()
      },
      onDrop: () => {
        if (dragging === null || dragging === id) return
        commitMove(dragging, id)
        setDragging(null)
      },
      onDragEnd: () => setDragging(null),
    }),
    [dragging, commitMove],
  )

  const hit = computeCacheHit(usage)
  const percent = pressurePercent(pressure)
  /** Everything the session has put through the model, in tokens. */
  const spent = totalTokens(usage)

  const hasContext = Boolean(pressure || usage || breakdown)
  const hasActivity = activity.skills.length > 0 || activity.calls.length > 0
  const hasServers = mcp.servers.length > 0

  const titles: Record<CardId, string> = {
    gauge: t('section.gauge'),
    skills: t('section.skills'),
    mcp: t('section.mcp'),
  }

  /** Title-bar glyphs; the same set the rows inside already use. */
  const icons: Record<CardId, React.ReactNode> = {
    gauge: <DonutIcon />,
    skills: <BoltIcon />,
    mcp: <ServerIcon />,
  }

  const dragHint = t('titlebar.dragHint')

  const summaries: Partial<Record<CardId, string>> = {
    gauge: spent !== undefined ? fmtMillions(spent) : undefined,
    skills: hasActivity ? t('skills.running') : undefined,
    mcp: hasServers
      ? `${mcp.servers.filter((server) => server.connected).length}/${mcp.servers.length}`
      : undefined,
  }

  /** The body of one card, in play mode. */
  function cardBody(id: CardId): React.ReactNode {
    switch (id) {
      case 'gauge': {
        if (!hasContext) return <Empty>{t('empty')}</Empty>
        // The app's own context popover, card for card: one measured headline,
        // the window split as legend rows, then the two 2×2 groups.
        return (
          <div className="osp-gauge">
            <div className="osp-gauge-head">
              <span className="osp-gauge-title">
                {t('gauge.used', { percent: percent !== null ? fmtPercentInt(percent) : '—' })}
              </span>
              <span className="osp-gauge-figure">
                {typeof pressure?.pressureTokens === 'number' ? `-${fmtTokens(pressure.pressureTokens)}` : '—'} /{' '}
                {fmtTokens(pressure?.contextWindow)}
              </span>
            </div>
            {percent !== null ? <Meter percent={percent} color={SEGMENT_COLORS.messages} /> : null}
            <div className="osp-legend">
              <div className="osp-legend-row">
                <span className="osp-legend-dot" style={{ backgroundColor: SEGMENT_COLORS.system }} />
                <span className="osp-legend-label">{t('row.system')}</span>
                <span className="osp-legend-value">{approx(breakdown?.systemTokens)}</span>
              </div>
              <div className="osp-legend-row">
                <span className="osp-legend-dot" style={{ backgroundColor: SEGMENT_COLORS.tools }} />
                <span className="osp-legend-label">{t('row.toolDefs')}</span>
                <span className="osp-legend-value">{approx(breakdown?.toolsTokens)}</span>
              </div>
              <div className="osp-legend-row">
                <span className="osp-legend-dot" style={{ backgroundColor: SEGMENT_COLORS.messages }} />
                <span className="osp-legend-label">{t('row.messages')}</span>
                <span className="osp-legend-value">{approx(breakdown?.messageTokens)}</span>
              </div>
            </div>
            <div className="osp-group">
              <div className="osp-group-title">{t('group.session')}</div>
              <div className="osp-grid">
                <GaugeCell label={t('rate.ttft')} value={avgFirstToken(stats, t)} />
                <GaugeCell label={t('rate.tps')} value={fmtTps(stats?.decodeTokens, stats?.decodeMs)} />
              </div>
            </div>
            <div className="osp-group">
              <div className="osp-group-title">{t('group.tokens')}</div>
              <div className="osp-grid">
                <GaugeCell label={t('row.cacheHit')} value={hit.hasInput ? fmtPercentInt(hit.percent) : '—'} />
                <GaugeCell label={t('row.total')} value={fmtMillions(spent)} />
              </div>
            </div>
          </div>
        )
      }
      case 'skills': {
        if (!hasActivity) return <Empty>{t('skills.none')}</Empty>
        return (
          <div className="osp-list">
            {activity.skills.map((name) => (
              <div key={`skill:${name}`} className="osp-live-row">
                <span className="osp-live-name">{name}</span>
                <span className="osp-live-flag">
                  <span className="osp-live-dot" />
                  {t('skills.running')}
                </span>
              </div>
            ))}
            {activity.calls.map((call) => (
              <div key={`call:${call.id}`} className="osp-live-row">
                <span className="osp-live-name">{call.tool === '' ? call.server : `${call.server} · ${call.tool}`}</span>
                <span className="osp-live-flag">
                  <span className="osp-live-dot" />
                  {t('skills.running')}
                </span>
              </div>
            ))}
          </div>
        )
      }
      case 'mcp': {
        if (!hasServers) return <Empty>{mcp.failed ? t('error.unknown') : t('mcp.none')}</Empty>
        return (
          <div className="osp-list">
            {mcp.servers.map((server) => (
              <div key={server.id} className="osp-mcp-row">
                <span className="osp-mcp-dot" data-tone={toneOf(server)} />
                <span className="osp-mcp-text">
                  <span className="osp-mcp-name">{server.server}</span>
                </span>
                <button
                  type="button"
                  className="osp-switch-btn"
                  data-on={server.connected || undefined}
                  data-busy={mcp.busy === server.id || undefined}
                  disabled={mcp.busy === server.id}
                  title={t('mcp.reconnectTitle', { server: server.server })}
                  aria-label={t('mcp.reconnectTitle', { server: server.server })}
                  onClick={() => {
                    void mcp.reconnect(server.id)
                  }}
                >
                  <span className="osp-switch-knob" />
                </button>
              </div>
            ))}
          </div>
        )
      }
    }
  }

  const anyContent = hasContext || hasActivity || hasServers

  return (
    <div className="osp-card" ref={attachCard}>
      <div className="osp-toolbar">
        <button
          type="button"
          className="osp-manage-btn"
          data-active={manage || undefined}
          onClick={() => setManage((current) => !current)}
        >
          {manage ? t('manage.done') : t('manage.open')}
        </button>
      </div>
      <div className="osp-scroll">
        {!anyContent ? <Empty>{t('empty')}</Empty> : null}
        {layout.order.map((id) =>
          manage ? (
            <div key={id} className="osp-card-slot" data-card-id={id}>
              <CollapsibleSection
                id={id}
                title={titles[id]}
                manage
                hidden={layout.hidden.includes(id)}
                onToggleHidden={() => toggleHidden(id)}
                drag={dragPropsOf(id)}
              />
            </div>
          ) : layout.hidden.includes(id) ? null : (
            <div
              key={id}
              className="osp-card-slot"
              data-card-id={id}
              data-lifting={lift === id || undefined}
              data-drop-side={dropTarget === id ? (dropSide ?? undefined) : undefined}
            >
              <CollapsibleSection
                id={id}
                title={titles[id]}
                icon={icons[id]}
                summary={summaries[id]}
                defaultExpanded
                headerDrag={headerDragOf(id)}
                toggleGuard={toggleGuard}
                dragHint={dragHint}
              >
                {cardBody(id)}
              </CollapsibleSection>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
