/**
 * The panels' stylesheet, injected once into the document head.
 *
 * Metrics come from the session-cards card set (which in turn measured
 * openchamber's work-status column: 24px heading rows, 28px readout rows, 4px
 * meters); colour comes from the host's own alias tokens so the panels follow
 * the app theme instead of shipping a palette.
 */
export const PANEL_CSS = `
.osp-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l2, light-dark(rgba(0,0,0,.08), rgba(255,255,255,.1)));
  background: var(--dsw-alias-bg-layer-1, light-dark(#ffffff, #1c1c1c));
  font-size: 13px;
  line-height: 1.4;
}
.osp-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  scrollbar-width: none;
}
.osp-scroll::-webkit-scrollbar { width: 0; height: 0; }

.osp-section { display: flex; flex-direction: column; position: relative; }
/* Cards render inside display:contents slots (the slots carry the drag-target
   id), so adjacency keys off the slot, not the section. */
.osp-card-slot { display: contents; }
.osp-card-slot + .osp-card-slot > .osp-section { margin-top: 18px; }

/* Pointer drag feedback: the lifted original dims in place, and the only
   landing cue is the insertion line in the gap on the side the pointer will
   land — the target bar itself gets no preview state. */
.osp-card-slot[data-lifting='true'] > .osp-section { opacity: 0.4; }
.osp-card-slot[data-drop-side] > .osp-section::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  height: 2px;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary, #4d6bfe);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 22%, transparent);
}
.osp-card-slot[data-drop-side='before'] > .osp-section::after { top: -10px; }
.osp-card-slot[data-drop-side='after'] > .osp-section::after { bottom: -10px; }

/* The drag ghost: the folded card's title bar, fixed above everything and
   moved by transform only so it tracks the pointer without layout. */
.osp-ghost {
  position: fixed;
  z-index: 9999;
  margin: 0;
  pointer-events: none;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, light-dark(#ffffff, #1c1c1c));
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.26);
  will-change: transform;
}
.osp-ghost > .osp-titlebar {
  background: var(--dsw-alias-bg-layer-1, light-dark(#ffffff, #1c1c1c));
  cursor: grabbing;
}
/* The carried bar reads as folded: its chevron points right, not down. */
.osp-ghost .osp-chevron svg { transform: rotate(-90deg); }

.osp-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  margin-bottom: 2px;
  padding: 0 4px;
}

/* Card title bar: identity strip (icon, title, summary, chevron) whose whole
   surface is a pointer drag handle; a plain click still folds the card. */
.osp-titlebar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  margin-bottom: 4px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l2, light-dark(rgba(0,0,0,.08), rgba(255,255,255,.1)));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, light-dark(rgba(0,0,0,.03), rgba(255,255,255,.05)));
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.osp-titlebar[data-dragging='true'] { opacity: 0.45; cursor: grabbing; }
.osp-tb-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: start;
  cursor: pointer;
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
.osp-tb-btn:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, light-dark(#3b82f6, #7aa7ff));
  outline-offset: -2px;
}
.osp-tb-icon {
  flex: none;
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary, light-dark(#5c5c5c, #a0a0a0));
}
.osp-title {
  flex: 0 0 auto;
  max-width: 65%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
.osp-subject {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}
.osp-spacer { flex: 1; }
.osp-summary {
  flex: 0 1 60%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: end;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}
.osp-chevron { flex: none; color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878)); }

.osp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: start;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
  font-size: 13px;
}
button.osp-row { cursor: pointer; }
button.osp-row:hover { background: var(--dsw-alias-interactive-bg-hover, light-dark(rgba(0,0,0,.04), rgba(255,255,255,.06))); }
button.osp-row:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, light-dark(#3b82f6, #7aa7ff));
  outline-offset: -2px;
}
.osp-icon { flex: none; display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; }
.osp-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.osp-value {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, light-dark(#5c5c5c, #a0a0a0));
}

.osp-meter {
  height: 4px;
  margin: 0 4px 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2, light-dark(rgba(0,0,0,.08), rgba(255,255,255,.1)));
}
.osp-meter-fill { height: 100%; border-radius: 999px; transition: width 240ms ease; }
.osp-meter-stacked { display: flex; gap: 2px; }
.osp-meter-seg { display: block; height: 100%; border-radius: 999px; min-width: 3px; }

.osp-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}

/* Toolbar: the only control the panels own; arrangement lives behind it. */
.osp-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px 0;
}
.osp-manage-btn {
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}
.osp-manage-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, light-dark(rgba(0,0,0,.04), rgba(255,255,255,.06)));
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
.osp-manage-btn[data-active] {
  color: var(--dsw-alias-brand-primary, #4d6bfe);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 12%, transparent);
}

/* Occupancy headline: percentage left, absolute pair right. */
.osp-usage {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 4px 6px;
}
.osp-usage-head {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
.osp-usage-figure {
  margin-inline-start: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}

/* Arrangement mode: drag to reorder, checkbox to show or hide. */
.osp-heading-manage { cursor: grab; user-select: none; }
.osp-heading-manage[data-dragging='true'] { opacity: 0.45; }
.osp-grip {
  flex: none;
  width: 12px;
  font-size: 12px;
  line-height: 1;
  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}
.osp-section[data-hidden='true'] .osp-title { opacity: 0.5; }
.osp-switch { display: inline-flex; align-items: center; }
.osp-switch input {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--dsw-alias-brand-primary, #4d6bfe);
}

/* Work in flight: name on the left, a live "running" flag on the right. */
.osp-list {
  display: flex;
  flex-direction: column;
  max-height: 220px;
  overflow-y: auto;
  margin-top: 2px;
}
.osp-live-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.1)));
}
.osp-live-row:first-child { border-top: 0; }
.osp-live-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
.osp-live-flag {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--dsw-alias-brand-primary, light-dark(#4d6bfe, #7c93ff));
}
.osp-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: osp-live-pulse 1.1s ease-in-out infinite;
}
@keyframes osp-live-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .osp-live-dot, .osp-mcp-dot[data-tone='warn'] { animation: none; opacity: 1; }
}

/* MCP servers: connection dot, name over state, and the reconnect switch. */
.osp-mcp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.1)));
}
.osp-mcp-row:first-child { border-top: 0; }
.osp-mcp-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
}
.osp-mcp-dot[data-tone='live'] { background: var(--dsw-alias-state-success-primary, #2f9e5f); }
.osp-mcp-dot[data-tone='warn'] {
  background: var(--dsw-alias-state-warn-primary, #d9982b);
  animation: osp-live-pulse 1.1s ease-in-out infinite;
}
.osp-mcp-dot[data-tone='error'] { background: var(--dsw-alias-state-error-primary, #d64545); }
.osp-mcp-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.osp-mcp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
}
/* Switch: 26x14 track, 10px knob, host tokens for both themes. */
.osp-switch-btn {
  flex: none;
  position: relative;
  width: 26px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  background: var(--dsw-alias-border-l2, light-dark(rgba(0, 0, 0, 0.16), rgba(255, 255, 255, 0.18)));
  transition: background 140ms ease;
}
.osp-switch-btn[data-on] { background: var(--dsw-alias-brand-primary, #4d6bfe); }
.osp-switch-btn:disabled { cursor: progress; opacity: 0.6; }
.osp-switch-btn:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, light-dark(#3b82f6, #7aa7ff));
  outline-offset: 2px;
}
.osp-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 140ms ease;
}
.osp-switch-btn[data-on] .osp-switch-knob { transform: translateX(12px); }
.osp-switch-btn[data-busy] .osp-switch-knob { animation: osp-live-pulse 1.1s ease-in-out infinite; }
`

const STYLE_ID = 'dsh-session-panels-style'

/** Mount the stylesheet once per document. */
export function ensureStyles(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc || doc.getElementById(STYLE_ID)) return
  const node = doc.createElement('style')
  node.id = STYLE_ID
  node.textContent = PANEL_CSS
  doc.head.appendChild(node)
}
