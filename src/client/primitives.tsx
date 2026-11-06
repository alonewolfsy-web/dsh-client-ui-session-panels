/**
 * Section vocabulary for the session panels, ported from the session-cards card
 * set: a section whose title bar folds the body and doubles as the drag handle,
 * plus the meter and the empty state its bodies draw with.
 */
import * as React from 'react'
import { ChevronIcon } from './icons'

const EXPANDED_KEY = 'dsh.sessionPanels.expanded.v1'

function readExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeExpanded(id: string, value: boolean): void {
  try {
    const next = { ...readExpanded(), [id]: value }
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: the section still expands for this mount */
  }
}
/** Drag handlers a section heading needs while arrangement is being managed. */
export interface DragProps {
  draggable: true
  dragging: boolean
  onDragStart: () => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}

/**
 * Pointer-drag wiring for the play-mode title bar: the bar itself is the
 * handle, so cards reorder any day without entering manage mode. The panel
 * owns the state machine; the section only renders the handlers and flags.
 */
export interface HeaderDragProps {
  /** This card is being dragged by its title bar. */
  dragging: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
}

/**
 * A section whose body folds away. Expanded state is persisted, not component
 * state: the pane unmounts on session switches and tab moves.
 *
 * Play mode renders the heading as a title bar — icon, title, summary,
 * chevron — whose whole surface is a pointer drag handle (see `headerDrag`);
 * a plain click still folds the card, because the panel only arms the drag
 * past a movement threshold and guards the click right after a real drag.
 * In manage mode the heading becomes a drag handle plus a visibility switch.
 */
export const CollapsibleSection: React.FC<{
  id: string
  title: string
  /** Glyph drawn before the title in the play-mode title bar. */
  icon?: React.ReactNode
  subject?: React.ReactNode
  summary?: React.ReactNode
  defaultExpanded?: boolean
  manage?: boolean
  hidden?: boolean
  onToggleHidden?: () => void
  drag?: DragProps
  /** Pointer-drag wiring for the title bar; absent → the bar is click-only. */
  headerDrag?: HeaderDragProps
  /** Returns true when the pending click must not fold the card (post-drag). */
  toggleGuard?: () => boolean
  /** Tooltip on the grip, naming what the bar does when dragged. */
  dragHint?: string
  /** Unused in manage mode, where the body folds away with the whole card. */
  children?: React.ReactNode
}> = ({
  id,
  title,
  icon,
  subject,
  summary,
  defaultExpanded = false,
  manage,
  hidden,
  onToggleHidden,
  drag,
  headerDrag,
  toggleGuard,
  dragHint,
  children,
}) => {
  const [stored, setStored] = React.useState<Record<string, boolean>>(readExpanded)
  const expanded = stored[id] ?? defaultExpanded

  const toggle = React.useCallback(() => {
    if (toggleGuard?.()) return // the click that ends a drag must not fold
    const next = !expanded
    setStored((current) => ({ ...current, [id]: next }))
    writeExpanded(id, next)
  }, [expanded, id, toggleGuard])

  if (manage) {
    return (
      <section className="osp-section" data-hidden={hidden || undefined}>
        <div
          className="osp-heading osp-heading-manage"
          data-dragging={drag?.dragging || undefined}
          draggable={drag?.draggable}
          onDragStart={drag?.onDragStart}
          onDragOver={drag?.onDragOver}
          onDrop={drag?.onDrop}
          onDragEnd={drag?.onDragEnd}
        >
          <span className="osp-grip" aria-hidden="true">
            ⠿
          </span>
          <span className="osp-title">
            {title}
            {subject ? <span className="osp-subject" style={{ marginInlineStart: 6 }}>{subject}</span> : null}
          </span>
          <span className="osp-spacer" />
          <label className="osp-switch">
            <input type="checkbox" checked={!hidden} onChange={onToggleHidden} aria-label={title} />
          </label>
        </div>
      </section>
    )
  }

  return (
    <section className="osp-section">
      <div
        className="osp-titlebar"
        data-dragging={headerDrag?.dragging || undefined}
        onPointerDown={headerDrag?.onPointerDown}
        onPointerMove={headerDrag?.onPointerMove}
        onPointerUp={headerDrag?.onPointerUp}
        onPointerCancel={headerDrag?.onPointerCancel}
      >
        <span className="osp-grip" aria-hidden="true" title={dragHint}>
          ⠿
        </span>
        <button type="button" className="osp-tb-btn" aria-expanded={expanded} onClick={toggle}>
          {icon ? <span className="osp-tb-icon">{icon}</span> : null}
          <span className="osp-title">
            {title}
            {subject ? <span className="osp-subject" style={{ marginInlineStart: 6 }}>{subject}</span> : null}
          </span>
          <span className="osp-spacer" />
          {summary !== undefined && summary !== null ? <span className="osp-summary">{summary}</span> : null}
          <span className="osp-chevron">
            <ChevronIcon open={expanded} />
          </span>
        </button>
      </div>
      {expanded ? children : null}
    </section>
  )
}

/** Context-window fill, drawn under its row rather than inside it. */
export const Meter: React.FC<{ percent: number; color: string }> = ({ percent, color }) => (
  <div className="osp-meter">
    <div
      className="osp-meter-fill"
      style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }}
    />
  </div>
)

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="osp-empty">{children}</div>
