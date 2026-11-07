/**
 * Interactive proof for the title-bar drag, in jsdom — the one behavior the
 * static smoke cannot reach, because pointer state machines only exist at
 * runtime. Replays the real event sequences a finger or mouse produces:
 *
 *   drag:    pointerdown → pointermove (≥ threshold, over another card) → pointerup
 *   click:   pointerdown → pointerup (no movement) → click
 *
 * and asserts what each must do: the drag reorders and persists but must not
 * fold the card; the click folds but must not reorder.
 *
 * v0.2.1 additions, from real-browser findings jsdom used to hide:
 *   - pointer capture must NOT be taken on pointerdown: capture retargets the
 *     trailing click to the bar, which kills the fold chevron. Capture is only
 *     allowed once the drag arms.
 *   - an armed drag must produce a title-bar ghost that follows the pointer,
 *     lift the original, and name the insertion side on the target slot —
 *     the target bar itself must stay unmarked.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ---- jsdom globals, before anything touches document ---- */
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event

/* jsdom has no pointer capture; record every request so the tests can pin
   WHEN the code asks for capture (the chevron bug lives in that timing). */
let captureCalls = 0
dom.window.HTMLElement.prototype.setPointerCapture = function () {
  captureCalls++
}
dom.window.HTMLElement.prototype.releasePointerCapture = function () {}

let loaded = null
dom.window.__ModuleLoader__ = { load(entry) { loaded = entry } }

const React = require('react')
const ReactDOM = require('react-dom/client')
const { flushSync } = require('react-dom')
await import(pathToFileURL(resolve(root, 'lib/client.js')).href)
assert.ok(loaded, 'bundle never called __ModuleLoader__.load')

const hostModules = { react: React, 'react/jsx-runtime': require('react/jsx-runtime') }
const mod = loaded.factory((name) => hostModules[name] ?? {})

/* ---- recording ctx (same shape smoke uses; no remote → effects resolve benignly) ---- */
const t = (key, params) => {
  const zh = { 'section.gauge': '统计', 'section.skills': '正在调用', 'section.mcp': 'MCP 服务器', 'titlebar.dragHint': '拖动标题栏调整卡片顺序', 'skills.running': '运行中', empty: '空' }
  let s = zh[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}
const ctx = {
  locale: { bind: () => t, register: () => {} },
  sidebarRightTabs: { register: () => {} },
  slots: {
    inject: (_name, register) => register(),
    register: (_spec, component) => { ctx._body = component },
  },
  effect: (fn) => fn(),
}
mod.apply(ctx)
const Body = ctx._body
assert.ok(Body, 'body never registered')

const projections = {
  contextPressure: { pressureTokens: 16384, projectedTokens: 18200, contextWindow: 256000 },
  tokenUsage: { uncachedInputTokens: 12300, outputTokens: 4100, cacheReadTokens: 88200, cacheWriteTokens: 0 },
  sessionStats: { turns: 3 },
  contextBreakdown: { systemTokens: 12050, toolsTokens: 8400, messageTokens: 24700 },
}

const container = document.createElement('div')
document.body.appendChild(container)
const root2 = ReactDOM.createRoot(container)
flushSync(() => root2.render(React.createElement(Body, { sessionId: 's1', useProjection: (key) => projections[key], t })))

let n = 0
const ok = (label) => console.log(`  ok ${++n}: ${label}`)

const slotsOf = () => [...container.querySelectorAll('[data-card-id]')]
const barOf = (id) => container.querySelector(`[data-card-id="${id}"] .osp-titlebar`)
const btnOf = (id) => container.querySelector(`[data-card-id="${id}"] .osp-tb-btn`)
const sectionOf = (id) => container.querySelector(`[data-card-id="${id}"] .osp-section`)
const ghostOf = () => document.body.querySelector('.osp-ghost')

/**
 * React 18 schedules updates (continuous events always, discrete ones mostly)
 * through its own macrotask scheduler; a single setTimeout can race it. Poll
 * until the expected value appears, with a deadline — deterministic, not lucky.
 */
const until = async (read, expected, label) => {
  for (let i = 0; i < 100; i++) {
    const actual = read()
    if (actual === expected) return actual
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.equal(read(), expected, `${label} (not reached within 500ms)`)
}

const fire = (element, type, props = {}) => {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { button: 0, pointerId: 1, ...props })
  element.dispatchEvent(event)
}

/** jsdom boxes are all zero-sized; the side call needs a real midpoint to chew on. */
const stubRect = (id, top, height) => {
  sectionOf(id).getBoundingClientRect = () => ({
    left: 0, top, right: 200, bottom: top + height, width: 200, height, x: 0, y: top,
  })
}
const unstubRect = (id) => { delete sectionOf(id).getBoundingClientRect }

/* ---- 1: initial order is the default, and nothing is written until a move ---- */
assert.deepEqual(slotsOf().map((el) => el.getAttribute('data-card-id')), ['gauge', 'skills', 'mcp'])
assert.equal(localStorage.getItem('dsh.sessionPanels.layout.v1'), null, 'mount must not write layout')
ok('initial mount: three slots in the default order, no layout written yet')

/* ---- 1b: a press must not take pointer capture (the chevron killer) ---- */
{
  const bar = barOf('gauge')
  fire(bar, 'pointerdown', { clientX: 5, clientY: 5 })
  fire(bar, 'pointermove', { clientX: 7, clientY: 6 }) // under the threshold
  fire(bar, 'pointerup', { clientX: 7, clientY: 6 })
  assert.equal(captureCalls, 0, 'pointer capture taken before the drag armed')
  ok('timing: a press below the threshold never takes pointer capture')
}

/* ---- 2: drag the gauge bar onto the mcp card's upper half ---- */
{
  const bar = barOf('gauge')
  let hits = 0
  document.elementFromPoint = () => { hits++; return container.querySelector('[data-card-id="mcp"]') }
  stubRect('mcp', 300, 40) // midpoint 320: a pointer above it inserts before mcp
  fire(bar, 'pointerdown', { clientX: 10, clientY: 10 })
  fire(bar, 'pointermove', { clientX: 10, clientY: 310 }) // well past the 6px threshold
  await until(() => hits, 1, 'hit-testing never ran during the drag')
  await until(() => bar.getAttribute('data-dragging'), 'true', 'drag never armed (no dragging flag)')
  assert.equal(captureCalls, 1, 'an armed drag must take pointer capture exactly once')
  await until(
    () => container.querySelector('[data-card-id="mcp"]').getAttribute('data-drop-side'),
    'before',
    'target slot never named the insertion side',
  )
  assert.equal(barOf('mcp').hasAttribute('data-drop'), false, 'the target bar must carry no landing preview')
  await until(
    () => container.querySelector('[data-card-id="gauge"]').getAttribute('data-lifting'),
    'true',
    'the lifted card never left a placeholder state',
  )
  await until(() => ghostOf() !== null, true, 'an armed drag never produced a ghost')
  assert.ok(ghostOf()?.querySelector('.osp-titlebar'), 'the ghost must carry the title bar')
  assert.equal(ghostOf()?.querySelector('.osp-section, .osp-gauge, .osp-list'), null, 'the ghost must not preview the card body')
  fire(bar, 'pointermove', { clientX: 10, clientY: 312 })
  await until(() => ghostOf()?.style.transform, 'translate(0px, 302px)', 'ghost did not follow the pointer')
  fire(bar, 'pointerup', { clientX: 10, clientY: 312 })
  // The pointer lands over the mcp card; jsdom has no hit-testing, so the test
  // plays the part of the compositor.
  delete document.elementFromPoint
  unstubRect('mcp')

  await until(() => ghostOf(), null, 'ghost survived the release')
  await until(
    () => JSON.parse(localStorage.getItem('dsh.sessionPanels.layout.v1') ?? 'null')?.order.join(','),
    'skills,gauge,mcp',
    'drag did not persist the move (gauge lands before mcp)',
  )
  await until(
    () => slotsOf().map((el) => el.getAttribute('data-card-id')).join(','),
    'skills,gauge,mcp',
    'drag did not reorder the DOM',
  )
  assert.equal(barOf('gauge').hasAttribute('data-dragging'), false, 'dragging flag stuck after release')
  assert.equal(container.querySelector('[data-card-id="mcp"]').hasAttribute('data-drop-side'), false, 'side indicator stuck after release')
  ok('drag: ghost follows the pointer, gauge lands before mcp, persists, cleans up')
}

/* ---- 2b: the lower half of a card means "insert after" ---- */
{
  const bar = barOf('skills')
  document.elementFromPoint = () => container.querySelector('[data-card-id="mcp"]')
  stubRect('mcp', 300, 40) // midpoint 320: a pointer below it inserts after mcp
  fire(bar, 'pointerdown', { clientX: 10, clientY: 10 })
  fire(bar, 'pointermove', { clientX: 10, clientY: 330 })
  await until(
    () => container.querySelector('[data-card-id="mcp"]').getAttribute('data-drop-side'),
    'after',
    'lower-half hover never flipped the insertion side',
  )
  fire(bar, 'pointerup', { clientX: 10, clientY: 330 })
  delete document.elementFromPoint
  unstubRect('mcp')
  await until(
    () => JSON.parse(localStorage.getItem('dsh.sessionPanels.layout.v1') ?? 'null')?.order.join(','),
    'gauge,mcp,skills',
    'lower-half drop did not insert after the target',
  )
  ok('sides: dropping on the lower half inserts after the target card')
}

/* ---- 3: the click that follows a drag must not fold the card ---- */
fire(btnOf('gauge'), 'click')
await until(() => btnOf('gauge').getAttribute('aria-expanded'), 'true', 'post-drag click folded the card')
ok('guard: the click trailing a drag is swallowed, the card stays open')

/* ---- 4: a plain click (no movement) folds as usual ---- */
{
  const bar = barOf('mcp')
  fire(bar, 'pointerdown', { clientX: 5, clientY: 5 })
  fire(bar, 'pointermove', { clientX: 7, clientY: 6 }) // 2.2px: under the threshold
  fire(bar, 'pointerup', { clientX: 7, clientY: 6 })
  fire(btnOf('mcp'), 'click')
  await until(() => btnOf('mcp').getAttribute('aria-expanded'), 'false', 'plain click did not fold')
  // and the order never moved
  assert.deepEqual(JSON.parse(localStorage.getItem('dsh.sessionPanels.layout.v1')).order, ['gauge', 'mcp', 'skills'])
  ok('threshold: a sub-threshold press stays a click and folds the card')
}

/* ---- 5: dragging onto empty space is a no-op ---- */
{
  const before = localStorage.getItem('dsh.sessionPanels.layout.v1')
  const bar = barOf('gauge')
  fire(bar, 'pointerdown', { clientX: 0, clientY: 0 })
  document.elementFromPoint = () => null
  fire(bar, 'pointermove', { clientX: 40, clientY: 400 })
  fire(bar, 'pointerup', { clientX: 40, clientY: 400 })
  delete document.elementFromPoint
  await until(() => ghostOf(), null, 'ghost survived a targetless release')
  assert.equal(localStorage.getItem('dsh.sessionPanels.layout.v1'), before, 'an aimless drag rewrote the layout')
  ok('no-op: dropping outside any card keeps the order and cleans the ghost')
}

/* ---- 6: unmount mid-drag must not strand the ghost on document.body ---- */
{
  const bar = barOf('skills')
  document.elementFromPoint = () => null // jsdom has no hit-testing; arm cleanly
  fire(bar, 'pointerdown', { clientX: 0, clientY: 0 })
  fire(bar, 'pointermove', { clientX: 30, clientY: 30 }) // past the threshold: armed
  await until(() => ghostOf() !== null, true, 'ghost missing before the unmount test')
  delete document.elementFromPoint
  root2.unmount()
  assert.equal(ghostOf(), null, 'the ghost survived the unmount and would float forever')
  ok('unmount: a drag in flight leaves no ghost behind')
}

/* ---- 7: switching sessions resets the in-flight rows ---- */
{
  // The entry body injects the plugin's own root ctx (client={ctx}), so the
  // stream stub belongs on the harness ctx, NOT on a prop — a prop would be
  // clobbered. The follow replays one skill invocation for sA, then holds
  // open until aborted; session sB yields nothing, so any row left is residue.
  ctx.remote = {
    session: {
      follow: async function* (request, signal) {
        if (request.address.sessionId === 'sA') {
          yield {
            type: 'event',
            event: { type: 'user/message', data: { source: { kind: 'skill-invocation', name: 'ds-review' } } },
          }
        }
        await new Promise((done) => {
          if (signal?.aborted) done()
          else signal?.addEventListener('abort', () => done())
        })
      },
    },
  }
  const container2 = document.createElement('div')
  document.body.appendChild(container2)
  const root3 = ReactDOM.createRoot(container2)
  const renderWith = (sessionId) =>
    flushSync(() =>
      root3.render(React.createElement(Body, { sessionId, useProjection: (key) => projections[key], t })),
    )
  renderWith('sA')
  await until(
    () => container2.querySelector('.osp-live-name')?.textContent ?? '',
    'ds-review',
    'the running row never showed for session sA',
  )
  renderWith('sB')
  await until(
    () => container2.querySelector('.osp-live-row') === null,
    true,
    'the previous session in-flight rows lingered after the switch',
  )
  root3.unmount()
  ok('session switch: in-flight rows reset instead of lingering')
}

/* ---- 10: a host that isolates the panel in a shadow root still gets styles ---- */
{
  const host = document.createElement('div')
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const mount = document.createElement('div')
  shadow.appendChild(mount)
  const shadowRoot = ReactDOM.createRoot(mount)
  flushSync(() =>
    shadowRoot.render(React.createElement(Body, { sessionId: 's1', useProjection: (key) => projections[key], t })),
  )
  assert.ok(shadow.querySelector('#dsh-session-panels-style'), 'shadow root never received the stylesheet')
  assert.ok(shadow.querySelector('.osp-card'), 'panel did not render inside the shadow root')
  shadowRoot.unmount()
  ok('shadow root: the stylesheet lands beside the panel, not only in document.head')
}

console.log(`\ndrag: ${n} groups passed`)
