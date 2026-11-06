window.__ModuleLoader__.load({
	id: "dsh-client-ui-session-panels",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		"use strict";
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
		  // If the importer is in node compatibility mode or this is not an ESM
		  // file that has been converted to a CommonJS file using a Babel-
		  // compatible transform (i.e. "__esModule" has not been set), then set
		  // "default" to the CommonJS "module.exports" for node compatibility.
		  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
		  mod
		));
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// src/client/index.tsx
		var index_exports = {};
		__export(index_exports, {
		  apply: () => apply,
		  fetchMcpServers: () => fetchMcpServers,
		  foldActiveMcp: () => foldActiveMcp,
		  foldActiveSkills: () => foldActiveSkills,
		  inject: () => inject,
		  reconnectMcpServer: () => reconnectMcpServer,
		  splitMcpToolName: () => splitMcpToolName,
		  watchSessionActivity: () => watchSessionActivity
		});
		module.exports = __toCommonJS(index_exports);

		// src/client/panel.tsx
		var React2 = __toESM(require("react"), 1);

		// src/client/format.ts
		function fmtTokens(value) {
		  if (value === void 0 || value === null || !Number.isFinite(value)) return "\u2014";
		  const n = Math.max(0, value);
		  if (n < 1e3) return String(Math.round(n));
		  if (n < 1e6) {
		    const k = n / 1e3;
		    return `${k < 100 ? k.toFixed(1) : Math.round(k)}K`;
		  }
		  return `${(n / 1e6).toFixed(2)}M`;
		}
		function fmtPercentInt(value) {
		  if (value === void 0 || value === null || !Number.isFinite(value)) return "\u2014";
		  return `${Math.round(Math.min(Math.max(value, 0), 100))}%`;
		}
		function fmtMillions(value) {
		  if (value === void 0 || value === null || !Number.isFinite(value)) return "\u2014";
		  return `${(Math.max(0, value) / 1e6).toFixed(2)}M`;
		}
		function fmtTps(tokens, ms) {
		  if (!tokens || !ms || !Number.isFinite(tokens) || !Number.isFinite(ms) || ms <= 0) return "\u2014";
		  const rate = tokens / (ms / 1e3);
		  if (!Number.isFinite(rate) || rate <= 0) return "\u2014";
		  return `${Math.round(rate)} tok/s`;
		}

		// src/client/folds.ts
		var MCP_PREFIX = "mcp__";
		var WATCH_WINDOW = 500;
		var MCP_STATUS_PATH = "/session-panels/mcp";
		var MCP_RECONNECT_PATH = "/session-panels/mcp/reconnect";
		var NO_ACTIVITY = { skills: [], calls: [] };
		function splitMcpToolName(name) {
		  if (typeof name !== "string" || !name.startsWith(MCP_PREFIX)) return null;
		  const rest = name.slice(MCP_PREFIX.length);
		  if (rest === "") return null;
		  const at = rest.indexOf("__");
		  return at < 0 ? { server: rest, tool: "" } : { server: rest.slice(0, at), tool: rest.slice(at + 2) };
		}
		function foldActiveSkills(names, event) {
		  if (event === null || typeof event !== "object") return names;
		  if (event.type === "turn/start" || event.type === "turn/end") {
		    return names.length === 0 ? names : [];
		  }
		  const name = invokedSkillName(event);
		  if (name === null || names.includes(name)) return names;
		  return [...names, name];
		}
		function invokedSkillName(event) {
		  if (event.type === "user/message") {
		    const source = event.data?.source;
		    if (source?.kind !== "skill-invocation") return null;
		    return typeof source.name === "string" && source.name !== "" ? source.name : null;
		  }
		  if (event.type === "tool/call" && event.data?.name === "skill") {
		    const args = parseToolArguments(event.data.arguments ?? event.data.input);
		    const name = args?.name;
		    return typeof name === "string" && name !== "" ? name : null;
		  }
		  return null;
		}
		function parseToolArguments(raw) {
		  if (raw === null || raw === void 0) return void 0;
		  if (typeof raw === "object") return raw;
		  if (typeof raw !== "string") return void 0;
		  try {
		    const parsed = JSON.parse(raw);
		    return parsed !== null && typeof parsed === "object" ? parsed : void 0;
		  } catch {
		    return void 0;
		  }
		}
		function foldActiveMcp(calls, event) {
		  if (event === null || typeof event !== "object") return calls;
		  if (event.type === "turn/start" || event.type === "turn/end") {
		    return calls.length === 0 ? calls : [];
		  }
		  const started = startedMcpCall(event);
		  if (started !== null) {
		    if (calls.some((call) => call.id === started.id)) return calls;
		    return [...calls, started];
		  }
		  const finished = finishedMcpCallId(event);
		  if (finished === null) return calls;
		  const next = calls.filter((call) => call.id !== finished);
		  return next.length === calls.length ? calls : next;
		}
		function startedMcpCall(event) {
		  if (event.type === "tool/ptc-dispatch-start") return mcpCall(event.data?.subCallId, event.data?.name);
		  if (event.type === "tool/call") return mcpCall(event.data?.callId, event.data?.name);
		  return null;
		}
		function finishedMcpCallId(event) {
		  if (event.type === "tool/ptc-dispatch") return idOrNull(event.data?.subCallId);
		  if (event.type === "tool/result") {
		    const message = event.data?.message;
		    return idOrNull(message?.toolCallId) ?? idOrNull(message?.source?.callId) ?? idOrNull(event.data?.callId);
		  }
		  return null;
		}
		function mcpCall(id, name) {
		  const key = idOrNull(id);
		  if (key === null) return null;
		  const parts = splitMcpToolName(name);
		  return parts === null ? null : { id: key, ...parts };
		}
		function idOrNull(value) {
		  return typeof value === "string" && value !== "" ? value : null;
		}
		async function watchSessionActivity(client, sessionId, signal, onActivity) {
		  const session = client?.remote?.session;
		  if (!sessionId || typeof session?.follow !== "function") throw new Error("unavailable");
		  let activity = NO_ACTIVITY;
		  const stream = session.follow(
		    { address: { kind: "session", sessionId }, assistantStream: true, maxMessages: WATCH_WINDOW },
		    signal
		  );
		  const fold = (event) => {
		    const skills = foldActiveSkills(activity.skills, event);
		    const calls = foldActiveMcp(activity.calls, event);
		    if (skills === activity.skills && calls === activity.calls) return false;
		    activity = { skills, calls };
		    return true;
		  };
		  for await (const frame of stream) {
		    if (frame?.type === "snapshot") {
		      activity = NO_ACTIVITY;
		      for (const record of frame.records ?? []) fold(record?.event);
		      onActivity(activity);
		      continue;
		    }
		    if (frame?.type !== "event") continue;
		    if (fold(frame.event)) onActivity(activity);
		  }
		  if (!signal?.aborted) onActivity(NO_ACTIVITY);
		}
		async function fetchMcpServers(fetcher, signal) {
		  return readStatus(await request(fetcher, MCP_STATUS_PATH, { signal }));
		}
		async function reconnectMcpServer(fetcher, id, signal) {
		  const path = `${MCP_RECONNECT_PATH}?id=${encodeURIComponent(id)}`;
		  return readStatus(await request(fetcher, path, { method: "POST", signal }));
		}
		async function request(fetcher, path, init) {
		  const call = fetcher ?? globalThis.fetch;
		  if (typeof call !== "function") throw new Error("unavailable");
		  const response = await call(path, { credentials: "same-origin", ...init });
		  if (!response.ok) throw new Error(`http-${response.status}`);
		  return response.json();
		}
		function readStatus(payload) {
		  const rows = Array.isArray(payload?.servers) ? payload.servers : [];
		  return rows.filter((row) => row && typeof row.id === "string" && typeof row.server === "string").map((row) => {
		    const state = typeof row.state === "string" ? row.state : "unknown";
		    const tools = typeof row.tools === "number" ? row.tools : null;
		    return {
		      id: row.id,
		      server: row.server,
		      transport: typeof row.transport === "string" ? row.transport : "",
		      target: typeof row.target === "string" ? row.target : "",
		      state,
		      tools,
		      // Older host halves omit the field; fall back to the same rule they use.
		      connected: typeof row.connected === "boolean" ? row.connected : state === "active" && tools !== 0
		    };
		  });
		}

		// src/client/icons.tsx
		var import_jsx_runtime = require("react/jsx-runtime");
		var base = (props) => ({
		  width: 14,
		  height: 14,
		  viewBox: "0 0 16 16",
		  fill: "none",
		  stroke: "currentColor",
		  strokeWidth: 1.4,
		  strokeLinecap: "round",
		  strokeLinejoin: "round",
		  "aria-hidden": true,
		  focusable: false,
		  className: props.className
		});
		function DonutIcon(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(props), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "5.4", opacity: "0.35" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 2.6a5.4 5.4 0 0 1 5.4 5.4" })
		  ] });
		}
		function BoltIcon(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(props), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.8 1.8 4.4 8.6h3l-.8 5.6 4.6-6.8h-3z" }) });
		}
		function ServerIcon(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(props), children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.4", y: "2.8", width: "11.2", height: "4.4", rx: "1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2.4", y: "8.8", width: "11.2", height: "4.4", rx: "1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.8 5h.01M4.8 11h.01", strokeWidth: "1.8" })
		  ] });
		}
		function ChevronIcon({ open, className }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base({ className }), children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.6 6.2 8 10.4l4.4-4.2" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.2 3.6 10.4 8l-4.2 4.4" }) });
		}

		// src/client/layout.ts
		var CARD_IDS = ["gauge", "skills", "mcp"];
		var LEGACY_IDS = { context: "gauge" };
		var STORAGE_KEY = "dsh.sessionPanels.layout.v1";
		var DEFAULT_LAYOUT = { order: [...CARD_IDS], hidden: [] };
		function isCardId(value) {
		  return typeof value === "string" && CARD_IDS.includes(value);
		}
		function normalize(raw) {
		  if (!raw || typeof raw !== "object") return { ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] };
		  const record = raw;
		  const seen = /* @__PURE__ */ new Set();
		  const order = [];
		  if (Array.isArray(record.order)) {
		    for (const entry of record.order) {
		      const id = typeof entry === "string" ? LEGACY_IDS[entry] ?? entry : entry;
		      if (isCardId(id) && !seen.has(id)) {
		        seen.add(id);
		        order.push(id);
		      }
		    }
		  }
		  for (const id of CARD_IDS) if (!seen.has(id)) order.push(id);
		  const hidden = Array.isArray(record.hidden) ? record.hidden.filter(isCardId) : [];
		  return { order, hidden };
		}
		function readLayout() {
		  try {
		    const raw = localStorage.getItem(STORAGE_KEY);
		    if (!raw) return normalize(void 0);
		    return normalize(JSON.parse(raw));
		  } catch {
		    return normalize(void 0);
		  }
		}
		function writeLayout(layout) {
		  try {
		    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
		  } catch {
		  }
		}
		function moveCard(order, from, to) {
		  if (from === to) return order;
		  const next = order.filter((id) => id !== from);
		  const at = next.indexOf(to);
		  if (at < 0) return order;
		  next.splice(at, 0, from);
		  return next;
		}
		function moveCardRelative(order, from, to, side) {
		  if (from === to) return order;
		  const rest = order.filter((id) => id !== from);
		  const at = rest.indexOf(to);
		  if (at < 0) return order;
		  return side === "before" ? [...rest.slice(0, at), from, ...rest.slice(at)] : [...rest.slice(0, at + 1), from, ...rest.slice(at + 1)];
		}

		// src/client/metrics.ts
		function computeCacheHit(usage) {
		  if (!usage || typeof usage !== "object") return { percent: 0, hasInput: false };
		  const input = usage.uncachedInputTokens ?? 0;
		  const read = usage.cacheReadTokens ?? 0;
		  const write = usage.cacheWriteTokens ?? 0;
		  const total = input + read + write;
		  if (total <= 0) return { percent: 0, hasInput: false };
		  const safeRead = Math.max(0, read);
		  const percent = Math.min(100, Math.max(0, safeRead / total * 100));
		  return { percent, hasInput: true };
		}
		function pressurePercent(pressure) {
		  const measured = pressure?.pressureTokens;
		  const window = pressure?.contextWindow;
		  if (typeof measured !== "number" || !Number.isFinite(measured) || typeof window !== "number" || !Number.isFinite(window) || window <= 0) {
		    return null;
		  }
		  return Math.min(100, Math.max(0, Math.max(0, measured) / window * 100));
		}

		// src/client/primitives.tsx
		var React = __toESM(require("react"), 1);
		var import_jsx_runtime2 = require("react/jsx-runtime");
		var EXPANDED_KEY = "dsh.sessionPanels.expanded.v1";
		function readExpanded() {
		  try {
		    const raw = localStorage.getItem(EXPANDED_KEY);
		    if (!raw) return {};
		    const parsed = JSON.parse(raw);
		    return parsed && typeof parsed === "object" ? parsed : {};
		  } catch {
		    return {};
		  }
		}
		function writeExpanded(id, value) {
		  try {
		    const next = { ...readExpanded(), [id]: value };
		    localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
		  } catch {
		  }
		}
		var CollapsibleSection = ({
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
		  children
		}) => {
		  const [stored, setStored] = React.useState(readExpanded);
		  const expanded = stored[id] ?? defaultExpanded;
		  const toggle = React.useCallback(() => {
		    if (toggleGuard?.()) return;
		    const next = !expanded;
		    setStored((current) => ({ ...current, [id]: next }));
		    writeExpanded(id, next);
		  }, [expanded, id, toggleGuard]);
		  if (manage) {
		    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: "osp-section", "data-hidden": hidden || void 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		      "div",
		      {
		        className: "osp-heading osp-heading-manage",
		        "data-dragging": drag?.dragging || void 0,
		        draggable: drag?.draggable,
		        onDragStart: drag?.onDragStart,
		        onDragOver: drag?.onDragOver,
		        onDrop: drag?.onDrop,
		        onDragEnd: drag?.onDragEnd,
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-grip", "aria-hidden": "true", children: "\u283F" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "osp-title", children: [
		            title,
		            subject ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-subject", style: { marginInlineStart: 6 }, children: subject }) : null
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-spacer" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "osp-switch", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: !hidden, onChange: onToggleHidden, "aria-label": title }) })
		        ]
		      }
		    ) });
		  }
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "osp-section", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		      "div",
		      {
		        className: "osp-titlebar",
		        "data-dragging": headerDrag?.dragging || void 0,
		        onPointerDown: headerDrag?.onPointerDown,
		        onPointerMove: headerDrag?.onPointerMove,
		        onPointerUp: headerDrag?.onPointerUp,
		        onPointerCancel: headerDrag?.onPointerCancel,
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-grip", "aria-hidden": "true", title: dragHint, children: "\u283F" }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "osp-tb-btn", "aria-expanded": expanded, onClick: toggle, children: [
		            icon ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-tb-icon", children: icon }) : null,
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "osp-title", children: [
		              title,
		              subject ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-subject", style: { marginInlineStart: 6 }, children: subject }) : null
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-spacer" }),
		            summary !== void 0 && summary !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-summary", children: summary }) : null,
		            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "osp-chevron", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronIcon, { open: expanded }) })
		          ] })
		        ]
		      }
		    ),
		    expanded ? children : null
		  ] });
		};
		var Meter = ({ percent, color }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "osp-meter", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		  "div",
		  {
		    className: "osp-meter-fill",
		    style: { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }
		  }
		) });
		var Empty = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "osp-empty", children });

		// src/client/styles.ts
		var PANEL_CSS = `
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
		   land \u2014 the target bar itself gets no preview state. */
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

		.osp-meter {
		  height: 4px;
		  margin: 0 4px 6px;
		  overflow: hidden;
		  border-radius: 999px;
		  background: var(--dsw-alias-border-l2, light-dark(rgba(0,0,0,.08), rgba(255,255,255,.1)));
		}
		.osp-meter-fill { height: 100%; border-radius: 999px; transition: width 240ms ease; }

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

		/* Context card: the app's own context popover, card for card \u2014 a measured
		   headline, one fill bar, three legend rows, then two 2\xD72 readout groups. */
		.osp-gauge {
		  display: flex;
		  flex-direction: column;
		  padding: 2px 4px 4px;
		}
		.osp-gauge-head {
		  display: flex;
		  align-items: baseline;
		  gap: 8px;
		}
		.osp-gauge-title {
		  font-size: 12px;
		  font-weight: 600;
		  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
		}
		.osp-gauge-figure {
		  margin-inline-start: auto;
		  font-size: 11px;
		  font-variant-numeric: tabular-nums;
		  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
		}
		.osp-gauge .osp-meter { margin: 6px 0 9px; }

		.osp-legend {
		  display: flex;
		  flex-direction: column;
		  gap: 6px;
		}
		.osp-legend-row {
		  display: flex;
		  align-items: center;
		  gap: 7px;
		  min-height: 16px;
		}
		.osp-legend-dot {
		  flex: none;
		  width: 6px;
		  height: 6px;
		  border-radius: 2px;
		}
		.osp-legend-label {
		  flex: 1;
		  min-width: 0;
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		  font-size: 12px;
		  color: var(--dsw-alias-label-secondary, light-dark(#5c5c5c, #a0a0a0));
		}
		.osp-legend-value {
		  flex: none;
		  font-size: 12px;
		  font-variant-numeric: tabular-nums;
		  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
		}

		/* Grouped readouts: caption above value, two columns to fit the narrow pane. */
		.osp-group { margin-top: 12px; }
		.osp-group-title {
		  margin-bottom: 6px;
		  font-size: 12px;
		  font-weight: 600;
		  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
		}
		.osp-grid {
		  display: grid;
		  grid-template-columns: 1fr 1fr;
		  gap: 8px 10px;
		}
		.osp-cell {
		  display: flex;
		  flex-direction: column;
		  gap: 2px;
		  min-width: 0;
		}
		.osp-cell-label {
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		  font-size: 11px;
		  color: var(--dsw-alias-label-tertiary, light-dark(#8a8a8a, #787878));
		}
		.osp-cell-value {
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		  font-size: 12px;
		  font-variant-numeric: tabular-nums;
		  color: var(--dsw-alias-label-primary, light-dark(#1a1a1a, #e8e8e8));
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
		`;
		var STYLE_ID = "dsh-session-panels-style";
		function ensureStyles(doc = typeof document === "undefined" ? void 0 : document) {
		  if (!doc || doc.getElementById(STYLE_ID)) return;
		  const node = doc.createElement("style");
		  node.id = STYLE_ID;
		  node.textContent = PANEL_CSS;
		  doc.head.appendChild(node);
		}

		// src/client/panel.tsx
		var import_jsx_runtime3 = require("react/jsx-runtime");
		var SEGMENT_COLORS = {
		  system: "var(--dsw-alias-label-tertiary, #8a8f98)",
		  tools: "var(--dsw-alias-state-warn-primary, #d9982b)",
		  messages: "var(--dsw-alias-brand-primary, #4d6bfe)"
		};
		function useSessionActivity(client, sessionId, initial) {
		  const [activity, setActivity] = React2.useState(initial ?? NO_ACTIVITY);
		  React2.useEffect(() => {
		    if (!sessionId) return;
		    setActivity(initial ?? NO_ACTIVITY);
		    const controller = new AbortController();
		    watchSessionActivity(client, sessionId, controller.signal, (a) => {
		      if (!controller.signal.aborted) setActivity(a);
		    }).catch(() => {
		    });
		    return () => controller.abort();
		  }, [client, sessionId]);
		  return activity;
		}
		function useMcpServers(initial) {
		  const [state, setState] = React2.useState(
		    initial && initial.length > 0 ? { servers: initial, failed: false } : { servers: [], failed: false }
		  );
		  const [busy, setBusy] = React2.useState(null);
		  React2.useEffect(() => {
		    let live = true;
		    fetchMcpServers(void 0).then((servers) => {
		      if (live) setState({ servers, failed: false });
		    }).catch(() => {
		      if (live) setState({ servers: [], failed: true });
		    });
		    return () => {
		      live = false;
		    };
		  }, []);
		  const reconnect = React2.useCallback(async (id) => {
		    setBusy(id);
		    try {
		      const servers = await reconnectMcpServer(void 0, id);
		      setState({ servers, failed: false });
		    } catch {
		    } finally {
		      setBusy(null);
		    }
		  }, []);
		  return { ...state, busy, reconnect };
		}
		function toneOf(server) {
		  if (server.connected) return "live";
		  if (server.state === "active") return "warn";
		  if (server.state === "failed" || server.state === "error") return "error";
		  return "idle";
		}
		function approx(value) {
		  return typeof value === "number" && Number.isFinite(value) ? `~${fmtTokens(value)}` : "\u2014";
		}
		function totalTokens(usage) {
		  if (!usage) return void 0;
		  const parts = ["uncachedInputTokens", "cacheReadTokens", "outputTokens"].map((key) => {
		    const value = usage[key];
		    return typeof value === "number" && Number.isFinite(value) ? value : null;
		  });
		  if (parts.every((value) => value === null)) return void 0;
		  return parts.reduce((sum, value) => sum + (value ?? 0), 0);
		}
		function avgFirstToken(stats, t) {
		  if (!stats?.ttftMs || !stats.ttftSteps) return "\u2014";
		  return `${(stats.ttftMs / stats.ttftSteps / 1e3).toFixed(1)}${t("unit.seconds")}`;
		}
		var GaugeCell = ({ label, value }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-cell", children: [
		  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-cell-label", title: label, children: label }),
		  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-cell-value", children: value })
		] });
		var SessionPanelsBody = (props) => {
		  const { useProjection, t, sessionId, client, initialActivity, initialServers } = props;
		  ensureStyles();
		  const pressure = useProjection("contextPressure");
		  const usage = useProjection("tokenUsage");
		  const stats = useProjection("sessionStats");
		  const breakdown = useProjection("contextBreakdown");
		  const activity = useSessionActivity(client, sessionId, initialActivity);
		  const mcp = useMcpServers(initialServers);
		  const [layout, setLayout] = React2.useState(readLayout);
		  const [manage, setManage] = React2.useState(false);
		  const [dragging, setDragging] = React2.useState(null);
		  const [dropTarget, setDropTarget] = React2.useState(null);
		  const [dropSide, setDropSide] = React2.useState(null);
		  const [lift, setLift] = React2.useState(null);
		  const pointerDrag = React2.useRef(null);
		  const dropRef = React2.useRef(null);
		  const sideRef = React2.useRef(null);
		  const ghostRef = React2.useRef(null);
		  const swallowClick = React2.useRef(false);
		  const toggleHidden = React2.useCallback((id) => {
		    setLayout((current) => {
		      const hidden = current.hidden.includes(id) ? current.hidden.filter((entry) => entry !== id) : [...current.hidden, id];
		      const next = { ...current, hidden };
		      writeLayout(next);
		      return next;
		    });
		  }, []);
		  const commitMove = React2.useCallback((from, to) => {
		    setLayout((current) => {
		      const next = { ...current, order: moveCard(current.order, from, to) };
		      writeLayout(next);
		      return next;
		    });
		  }, []);
		  const commitMoveRelative = React2.useCallback((from, to, side) => {
		    setLayout((current) => {
		      const next = { ...current, order: moveCardRelative(current.order, from, to, side) };
		      writeLayout(next);
		      return next;
		    });
		  }, []);
		  const clearGhost = React2.useCallback(() => {
		    ghostRef.current?.remove();
		    ghostRef.current = null;
		    setLift(null);
		  }, []);
		  React2.useEffect(
		    () => () => {
		      ghostRef.current?.remove();
		      ghostRef.current = null;
		    },
		    []
		  );
		  const toggleGuard = React2.useCallback(() => {
		    const swallowed = swallowClick.current;
		    swallowClick.current = false;
		    return swallowed;
		  }, []);
		  const headerDragOf = React2.useCallback(
		    (id) => ({
		      dragging: dragging === id,
		      onPointerDown: (event) => {
		        if (event.button !== 0) return;
		        swallowClick.current = false;
		        pointerDrag.current = { id, x: event.clientX, y: event.clientY, active: false };
		      },
		      onPointerMove: (event) => {
		        const state = pointerDrag.current;
		        if (!state || state.id !== id) return;
		        if (!state.active) {
		          const dx = event.clientX - state.x;
		          const dy = event.clientY - state.y;
		          if (dx * dx + dy * dy < 36) return;
		          state.active = true;
		          try {
		            event.currentTarget.setPointerCapture(event.pointerId);
		          } catch {
		          }
		          const bar = event.currentTarget;
		          const rect = bar.getBoundingClientRect();
		          const ghost2 = document.createElement("div");
		          ghost2.className = "osp-ghost";
		          const carried = bar.cloneNode(true);
		          carried.removeAttribute("data-dragging");
		          carried.removeAttribute("data-drop");
		          carried.style.marginBottom = "0";
		          ghost2.appendChild(carried);
		          if (rect.width > 0) {
		            ghost2.style.left = `${rect.left}px`;
		            ghost2.style.top = `${rect.top}px`;
		            ghost2.style.width = `${rect.width}px`;
		          }
		          document.body.appendChild(ghost2);
		          ghostRef.current = ghost2;
		          setDragging(id);
		          setLift(id);
		        }
		        const ghost = ghostRef.current;
		        if (ghost) {
		          ghost.style.transform = `translate(${event.clientX - state.x}px, ${event.clientY - state.y}px)`;
		        }
		        const under = document.elementFromPoint(event.clientX, event.clientY);
		        const slot = under?.closest("[data-card-id]");
		        const raw = slot?.getAttribute("data-card-id") ?? null;
		        const target = raw !== null && raw !== id && !layout.hidden.includes(raw) ? raw : null;
		        let side = null;
		        if (target) {
		          const rect = slot?.querySelector(".osp-section")?.getBoundingClientRect();
		          const mid = rect && rect.height > 0 ? rect.top + rect.height / 2 : null;
		          side = mid === null ? "before" : event.clientY >= mid ? "after" : "before";
		        }
		        dropRef.current = target;
		        sideRef.current = side;
		        setDropTarget(target);
		        setDropSide(side);
		      },
		      onPointerUp: (event) => {
		        const state = pointerDrag.current;
		        pointerDrag.current = null;
		        if (state?.active) {
		          swallowClick.current = true;
		          const target = dropRef.current;
		          const side = sideRef.current;
		          if (target && side) commitMoveRelative(id, target, side);
		          try {
		            event.currentTarget.releasePointerCapture(event.pointerId);
		          } catch {
		          }
		        }
		        dropRef.current = null;
		        sideRef.current = null;
		        clearGhost();
		        setDragging(null);
		        setDropTarget(null);
		        setDropSide(null);
		      },
		      onPointerCancel: () => {
		        pointerDrag.current = null;
		        dropRef.current = null;
		        sideRef.current = null;
		        clearGhost();
		        setDragging(null);
		        setDropTarget(null);
		        setDropSide(null);
		      }
		    }),
		    [dragging, layout.hidden, commitMoveRelative, clearGhost]
		  );
		  const dragPropsOf = React2.useCallback(
		    (id) => ({
		      draggable: true,
		      dragging: dragging === id,
		      onDragStart: () => setDragging(id),
		      onDragOver: (event) => {
		        if (dragging !== null && dragging !== id) event.preventDefault();
		      },
		      onDrop: () => {
		        if (dragging === null || dragging === id) return;
		        commitMove(dragging, id);
		        setDragging(null);
		      },
		      onDragEnd: () => setDragging(null)
		    }),
		    [dragging, commitMove]
		  );
		  const hit = computeCacheHit(usage);
		  const percent = pressurePercent(pressure);
		  const spent = totalTokens(usage);
		  const hasContext = Boolean(pressure || usage || breakdown);
		  const hasActivity = activity.skills.length > 0 || activity.calls.length > 0;
		  const hasServers = mcp.servers.length > 0;
		  const titles = {
		    gauge: t("section.gauge"),
		    skills: t("section.skills"),
		    mcp: t("section.mcp")
		  };
		  const icons = {
		    gauge: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(DonutIcon, {}),
		    skills: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BoltIcon, {}),
		    mcp: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ServerIcon, {})
		  };
		  const dragHint = t("titlebar.dragHint");
		  const summaries = {
		    gauge: spent !== void 0 ? fmtMillions(spent) : void 0,
		    skills: hasActivity ? t("skills.running") : void 0,
		    mcp: hasServers ? `${mcp.servers.filter((server) => server.connected).length}/${mcp.servers.length}` : void 0
		  };
		  function cardBody(id) {
		    switch (id) {
		      case "gauge": {
		        if (!hasContext) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { children: t("empty") });
		        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-gauge", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-gauge-head", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-gauge-title", children: t("gauge.used", { percent: percent !== null ? fmtPercentInt(percent) : "\u2014" }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "osp-gauge-figure", children: [
		              typeof pressure?.pressureTokens === "number" ? `-${fmtTokens(pressure.pressureTokens)}` : "\u2014",
		              " /",
		              " ",
		              fmtTokens(pressure?.contextWindow)
		            ] })
		          ] }),
		          percent !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Meter, { percent, color: SEGMENT_COLORS.messages }) : null,
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-legend", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-legend-row", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-dot", style: { backgroundColor: SEGMENT_COLORS.system } }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-label", children: t("row.system") }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-value", children: approx(breakdown?.systemTokens) })
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-legend-row", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-dot", style: { backgroundColor: SEGMENT_COLORS.tools } }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-label", children: t("row.toolDefs") }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-value", children: approx(breakdown?.toolsTokens) })
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-legend-row", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-dot", style: { backgroundColor: SEGMENT_COLORS.messages } }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-label", children: t("row.messages") }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-legend-value", children: approx(breakdown?.messageTokens) })
		            ] })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-group", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "osp-group-title", children: t("group.session") }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-grid", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GaugeCell, { label: t("rate.ttft"), value: avgFirstToken(stats, t) }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GaugeCell, { label: t("rate.tps"), value: fmtTps(stats?.decodeTokens, stats?.decodeMs) })
		            ] })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-group", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "osp-group-title", children: t("group.tokens") }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-grid", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GaugeCell, { label: t("row.cacheHit"), value: hit.hasInput ? fmtPercentInt(hit.percent) : "\u2014" }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GaugeCell, { label: t("row.total"), value: fmtMillions(spent) })
		            ] })
		          ] })
		        ] });
		      }
		      case "skills": {
		        if (!hasActivity) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { children: t("skills.none") });
		        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-list", children: [
		          activity.skills.map((name) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-live-row", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-live-name", children: name }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "osp-live-flag", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-live-dot" }),
		              t("skills.running")
		            ] })
		          ] }, `skill:${name}`)),
		          activity.calls.map((call) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-live-row", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-live-name", children: call.tool === "" ? call.server : `${call.server} \xB7 ${call.tool}` }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "osp-live-flag", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-live-dot" }),
		              t("skills.running")
		            ] })
		          ] }, `call:${call.id}`))
		        ] });
		      }
		      case "mcp": {
		        if (!hasServers) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { children: mcp.failed ? t("error.unknown") : t("mcp.none") });
		        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "osp-list", children: mcp.servers.map((server) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-mcp-row", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-mcp-dot", "data-tone": toneOf(server) }),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-mcp-text", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-mcp-name", children: server.server }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		            "button",
		            {
		              type: "button",
		              className: "osp-switch-btn",
		              "data-on": server.connected || void 0,
		              "data-busy": mcp.busy === server.id || void 0,
		              disabled: mcp.busy === server.id,
		              title: t("mcp.reconnectTitle", { server: server.server }),
		              "aria-label": t("mcp.reconnectTitle", { server: server.server }),
		              onClick: () => {
		                void mcp.reconnect(server.id);
		              },
		              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "osp-switch-knob" })
		            }
		          )
		        ] }, server.id)) });
		      }
		    }
		  }
		  const anyContent = hasContext || hasActivity || hasServers;
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-card", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "osp-toolbar", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		      "button",
		      {
		        type: "button",
		        className: "osp-manage-btn",
		        "data-active": manage || void 0,
		        onClick: () => setManage((current) => !current),
		        children: manage ? t("manage.done") : t("manage.open")
		      }
		    ) }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "osp-scroll", children: [
		      !anyContent ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { children: t("empty") }) : null,
		      layout.order.map(
		        (id) => manage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "osp-card-slot", "data-card-id": id, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		          CollapsibleSection,
		          {
		            id,
		            title: titles[id],
		            manage: true,
		            hidden: layout.hidden.includes(id),
		            onToggleHidden: () => toggleHidden(id),
		            drag: dragPropsOf(id)
		          }
		        ) }, id) : layout.hidden.includes(id) ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		          "div",
		          {
		            className: "osp-card-slot",
		            "data-card-id": id,
		            "data-lifting": lift === id || void 0,
		            "data-drop-side": dropTarget === id ? dropSide ?? void 0 : void 0,
		            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		              CollapsibleSection,
		              {
		                id,
		                title: titles[id],
		                icon: icons[id],
		                summary: summaries[id],
		                defaultExpanded: true,
		                headerDrag: headerDragOf(id),
		                toggleGuard,
		                dragHint,
		                children: cardBody(id)
		              }
		            )
		          },
		          id
		        )
		      )
		    ] })
		  ] });
		};

		// src/client/locales.ts
		var zh = {
		  // The tab strip is narrow: a short label keeps it from truncating. The
		  // add-tab guide keeps the full name, where there is room to explain itself.
		  "type.label": "\u5361\u7247",
		  "guide.title": "\u53F3\u4FA7\u9762\u677F\u5361\u7247\u63D2\u4EF6",
		  "guide.description": "\u4E0A\u4E0B\u6587\u538B\u529B\u3001\u7F13\u5B58\u5206\u6790\u3001\u8F6E\u6B21\u7EDF\u8BA1\u4E0E MCP \u8FDE\u63A5",
		  "manage.open": "\u7BA1\u7406\u5361\u7247",
		  "manage.done": "\u5B8C\u6210",
		  "titlebar.dragHint": "\u62D6\u52A8\u6807\u9898\u680F\u8C03\u6574\u5361\u7247\u987A\u5E8F",
		  empty: "\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6570\u636E",
		  "section.gauge": "\u7EDF\u8BA1",
		  "section.skills": "\u6B63\u5728\u8C03\u7528",
		  "section.mcp": "MCP \u670D\u52A1\u5668",
		  // The gauge card mirrors the app's own context popover, wording included.
		  "gauge.used": "\u4E0A\u6587\u5DF2\u7528 {percent}",
		  "group.session": "\u4F1A\u8BDD\u7EDF\u8BA1",
		  "group.tokens": "Token \u7528\u91CF",
		  "rate.ttft": "\u9996 token \u5E73\u5747\uFF08TTFT\uFF09",
		  "rate.tps": "\u8F93\u51FA\u901F\u5EA6\uFF08TPS\uFF09",
		  "row.system": "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
		  "row.toolDefs": "\u5DE5\u5177\u5B9A\u4E49",
		  "row.messages": "\u5BF9\u8BDD\u6D88\u606F",
		  "row.cacheHit": "\u7F13\u5B58\u547D\u4E2D",
		  "row.total": "Token \u603B\u91CF",
		  "unit.seconds": " \u79D2",
		  "skills.none": "\u6CA1\u6709\u6B63\u5728\u8C03\u7528\u7684\u6280\u80FD",
		  "skills.running": "\u8FD0\u884C\u4E2D",
		  "mcp.none": "\u6CA1\u6709\u914D\u7F6E MCP \u670D\u52A1\u5668",
		  "mcp.reconnectTitle": "\u91CD\u8FDE {server}",
		  "error.unknown": "\u72B6\u6001\u672A\u77E5"
		};
		var en = {
		  "type.label": "Cards",
		  "guide.title": "Right panel cards",
		  "guide.description": "Context pressure, cache analytics, turn stats and MCP connections",
		  "manage.open": "Manage cards",
		  "manage.done": "Done",
		  "titlebar.dragHint": "Drag a title bar to reorder cards",
		  empty: "Nothing to show for this session yet",
		  "section.gauge": "Usage",
		  "section.skills": "In flight",
		  "section.mcp": "MCP servers",
		  "gauge.used": "Context used {percent}",
		  "group.session": "Session stats",
		  "group.tokens": "Token usage",
		  "rate.ttft": "Avg first token (TTFT)",
		  "rate.tps": "Output speed (TPS)",
		  "row.system": "System prompt",
		  "row.toolDefs": "Tool definitions",
		  "row.messages": "Messages",
		  "row.cacheHit": "Cache hit",
		  "row.total": "Total tokens",
		  "unit.seconds": " s",
		  "skills.none": "No skills in flight",
		  "skills.running": "running",
		  "mcp.none": "No MCP servers configured",
		  "mcp.reconnectTitle": "Reconnect {server}",
		  "error.unknown": "Status unknown"
		};

		// src/client/index.tsx
		var import_jsx_runtime4 = require("react/jsx-runtime");
		var NS = "sessionPanels";
		var KIND = "session-panels";
		var ID = "dsh-client-ui-session-panels";
		function definition(t) {
		  return {
		    id: ID,
		    kind: KIND,
		    priority: "extension",
		    title: () => t("type.label"),
		    guide: [
		      {
		        id: "panels",
		        order: 5,
		        title: () => t("guide.title"),
		        description: () => t("guide.description")
		      }
		    ]
		  };
		}
		var inject = ["slots", "locale", "remote", "remote.session", "sidebarRightTabs"];
		function apply(ctx) {
		  try {
		    const t = ctx.locale.bind(NS);
		    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-session-panels: dictionaries");
		    ctx.effect(() => ctx.sidebarRightTabs.register(definition(t)), "ui-session-panels: tab type");
		    const Body = (props) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SessionPanelsBody, { ...props, client: ctx });
		    ctx.effect(
		      () => ctx.slots.inject(
		        "sidebar.right.pane.tab",
		        () => ctx.slots.register(
		          {
		            name: "sidebar.right.pane.tab",
		            key: ID,
		            locale: NS
		          },
		          Body
		        )
		      ),
		      "ui-session-panels: tab body"
		    );
		  } catch (error) {
		    console.error("[session-panels] apply failed:", error instanceof Error ? error.stack : String(error));
		  }
		}

		return module.exports;
	}
});
