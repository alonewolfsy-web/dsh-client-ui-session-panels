/**
 * Load the built client bundle the way the host does, run its apply() against a
 * recording context, then server-render the registered body with sample
 * projections and fixture activity. Proves both halves of the wiring without
 * launching the app.
 *
 * Effects never run under renderToStaticMarkup, so the activity and MCP
 * sections are asserted through the `initialActivity` / `initialServers` props
 * (production omits them; the stream supplies the same data live).
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let loaded = null
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      loaded = entry
    },
  },
}

await import(pathToFileURL(resolve(root, 'lib/client.js')).href)
assert.ok(loaded, 'bundle never called __ModuleLoader__.load')
assert.equal(loaded.id, 'dsh-client-ui-session-panels')

const hostModules = {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
}
const mod = loaded.factory((name) => {
  if (hostModules[name]) return hostModules[name]
  return {}
})

/* ---- apply() against a recording context ---- */
const effects = []
let registeredLocales = null
let tabDefinition = null
const slotRegistrations = []

const zhDict = {
  'type.label': '卡片',
  'guide.title': '右侧面板卡片插件',
  'guide.description': '上下文压力、缓存分析、轮次统计与 MCP 连接',
  'manage.open': '管理卡片',
  'manage.done': '完成',
  'titlebar.dragHint': '拖动标题栏调整卡片顺序',
  empty: '这个会话还没有可显示的数据',
  'section.gauge': '统计',
  'section.skills': '正在调用',
  'section.mcp': 'MCP 服务器',
  'gauge.used': '上文已用 {percent}',
  'group.session': '会话统计',
  'group.tokens': 'Token 用量',
  'rate.ttft': '首 token 平均（TTFT）',
  'rate.tps': '输出速度（TPS）',
  'row.system': '系统提示词',
  'row.toolDefs': '工具定义',
  'row.messages': '对话消息',
  'row.cacheHit': '缓存命中',
  'row.total': 'Token 总量',
  'unit.seconds': ' 秒',
  'skills.none': '没有正在调用的技能',
  'skills.running': '运行中',
  'mcp.none': '没有配置 MCP 服务器',
  'mcp.reconnectTitle': '重连 {server}',
  'error.unknown': '状态未知',
}
const t = (key, params) => {
  let s = zhDict[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  }
  return s
}

const ctx = {
  locale: {
    bind: () => t,
    register: (ns, dicts) => {
      registeredLocales = { ns, dicts }
    },
  },
  sidebarRightTabs: {
    register: (definition) => {
      tabDefinition = definition
    },
  },
  slots: {
    inject: (slotName, register) => {
      if (slotName === 'sidebar.right.pane.tab') register()
    },
    register: (spec, component) => {
      slotRegistrations.push({ spec, component })
    },
  },
  effect: (fn, label) => {
    effects.push(label)
    fn()
  },
}

assert.equal(typeof mod.apply, 'function', 'client module exports apply()')
assert.deepEqual(mod.inject, ['slots', 'locale', 'remote', 'remote.session', 'sidebarRightTabs'])
console.log('  ok 1: client module shape (apply + declared inject list)')

mod.apply(ctx)
assert.deepEqual(effects, [
  'ui-session-panels: dictionaries',
  'ui-session-panels: tab type',
  'ui-session-panels: tab body',
])
console.log('  ok 2: apply() ran the three labelled effects')

assert.ok(registeredLocales, 'locale dictionaries never registered')
assert.equal(registeredLocales.ns, 'sessionPanels')
const zhKeys = Object.keys(registeredLocales.dicts.zh).sort()
const enKeys = Object.keys(registeredLocales.dicts.en).sort()
assert.deepEqual(zhKeys, enKeys)
assert.equal(zhKeys.length, Object.keys(zhDict).length)
console.log(`  ok 3: zh/en dictionaries registered and key-complete (${zhKeys.length} keys)`)

assert.ok(tabDefinition, 'tab type never registered')
assert.equal(tabDefinition.id, 'dsh-client-ui-session-panels')
assert.equal(tabDefinition.kind, 'session-panels')
assert.equal(tabDefinition.title(), '卡片')
assert.equal(tabDefinition.guide[0].description(), '上下文压力、缓存分析、轮次统计与 MCP 连接')
console.log('  ok 4: tab type registered with kind + localized guide')

assert.equal(slotRegistrations.length, 1)
assert.equal(slotRegistrations[0].spec.name, 'sidebar.right.pane.tab')
assert.equal(slotRegistrations[0].spec.key, 'dsh-client-ui-session-panels')
assert.equal(slotRegistrations[0].spec.locale, 'sessionPanels')
assert.equal(typeof slotRegistrations[0].component, 'function')
console.log('  ok 5: body registered under sidebar.right.pane.tab')

/* ---- render the body with fixtures ---- */
const projections = {
  contextPressure: { pressureTokens: 16384, projectedTokens: 18200, contextWindow: 256000 },
  tokenUsage: { uncachedInputTokens: 12300, outputTokens: 4100, cacheReadTokens: 88200, cacheWriteTokens: 0 },
  sessionStats: { turns: 3, steps: 12, llmMs: 72000, toolMs: 34200, ttftMs: 2400, ttftSteps: 3, decodeMs: 41000, decodeTokens: 1681 },
  contextBreakdown: { systemTokens: 12050, toolsTokens: 8400, messageTokens: 24700 },
}

const initialServers = [
  { id: 'ctx7', server: 'context7', transport: 'streamable-http', target: 'https://mcp.context7.com/mcp', state: 'active', tools: 3, connected: true },
  { id: 'gh', server: 'github', transport: 'stdio', target: 'npx @modelcontextprotocol/server-github', state: 'failed', tools: 0, connected: false },
]

const Body = slotRegistrations[0].component
const html = renderToStaticMarkup(
  React.createElement(Body, {
    sessionId: 'session-test',
    useProjection: (key) => projections[key],
    t,
    initialActivity: { skills: ['review'], calls: [{ id: 'c1', server: 'context7', tool: 'resolve' }] },
    initialServers,
  }),
)

let n = 5
const ok = (label) => console.log(`  ok ${++n}: ${label}`)

/* structure */
assert.ok(html.includes('osp-card') && html.includes('osp-scroll'), 'card shell classes missing')
assert.ok(html.includes('管理卡片'), 'manage button missing')
assert.ok(html.includes('osp-tb-btn') && html.includes('osp-section'), 'collapsible sections missing')
ok('card shell, toolbar, sections render')

/* title bars + drag affordance */
assert.equal(html.split('class="osp-titlebar"').length - 1, 3, 'expected exactly three title bars')
assert.ok(html.includes('osp-grip'), 'title bar grip missing')
assert.ok(html.includes('osp-tb-icon'), 'title bar icon missing')
assert.ok(html.includes('data-card-id="gauge"') && html.includes('data-card-id="mcp"'), 'card slots missing ids')
assert.ok(html.includes('拖动标题栏调整卡片顺序'), 'drag hint missing')
ok('title bars: three bars, grip, icon, drag hint, per-card drag slots')

/* gauge card: the app's context popover, reproduced */
assert.ok(html.includes('>统计<'), 'gauge title missing')
assert.ok(html.includes('上文已用 6%'), 'gauge headline missing (16384/256000 = 6.4% → 6%)')
assert.ok(html.includes('-16.4K / 256K'), 'measured/window figures missing')
assert.ok(
  html.includes('~12.1K') && html.includes('~8.4K') && html.includes('~24.7K'),
  'legend figures missing (12050 / 8400 / 24700)',
)
assert.ok(
  html.includes('系统提示词') && html.includes('工具定义') && html.includes('对话消息'),
  'legend labels missing',
)
assert.ok(html.includes('osp-legend-dot'), 'legend colour dots missing')
ok('gauge card: title, headline, window pair and three legend rows')

/* gauge card: the two readout groups */
assert.ok(html.includes('会话统计') && html.includes('Token 用量'), 'group titles missing')
assert.ok(html.includes('0.8 秒'), 'average first token missing (2400ms / 3 steps)')
assert.ok(html.includes('>41 tok/s<'), 'output speed missing (1681 tok / 41000ms)')
assert.ok(!html.includes('模型用时') && !html.includes('工具调用用时'), 'timing cells should be gone')
assert.ok(html.includes('>88%<'), 'cache hit percentage missing (88200/100500 = 87.8% → 88%)')
assert.ok(html.includes('Token 总量'), 'total token label missing')
assert.ok(html.includes('0.10M'), 'token total missing (12300 + 88200 + 4100 = 104600 → 0.10M)')
assert.ok(
  !html.includes('未缓存输入') && !html.includes('缓存读取') && !html.includes('>输出<'),
  'the split token cells should be gone',
)
ok('gauge card: session stats keep TTFT + TPS, tokens collapse into one total in M')

/* the retired turn-stats card leaves nothing behind */
assert.ok(!html.includes('轮次统计'), 'turns card still rendered')
assert.ok(!html.includes('data-card-id="turns"'), 'turns slot still rendered')
ok('turns card removed from the body and the layout')

/* skills + mcp from the SSR fixtures */
assert.ok(html.includes('正在调用') && html.includes('运行中'), 'skills section missing')
assert.ok(html.includes('>review<'), 'skill in flight missing')
assert.ok(html.includes('context7 · resolve'), 'mcp call in flight missing')
assert.ok(html.includes('MCP 服务器') && html.includes('1/2'), 'mcp section or connected count missing')
assert.ok(html.includes('data-tone="live"'), 'connected dot tone missing')
assert.ok(html.includes('data-tone="error"'), 'failed dot tone missing')
assert.ok(html.includes('data-on'), 'connected switch state missing')
assert.ok(html.includes('重连 github'), 'reconnect title missing')
ok('activity sections: skills fold, mcp rows, tones, reconnect switch')

/* empty state */
const emptyHtml = renderToStaticMarkup(
  React.createElement(Body, {
    sessionId: 'session-test',
    useProjection: () => undefined,
    t,
  }),
)
assert.ok(emptyHtml.includes('这个会话还没有可显示的数据'), 'outer empty state missing')
assert.ok(emptyHtml.includes('没有正在调用的技能'), 'skills empty missing')
assert.ok(emptyHtml.includes('没有配置 MCP 服务器'), 'mcp empty missing')
ok('empty session renders the empty states, not a blank card')

/* locale coverage of the rendered strings */
const missing = ['osp-card', 'osp-mcp-row', 'osp-switch-btn', 'osp-gauge-title', 'osp-cell-value', 'osp-summary', 'osp-titlebar'].filter((cls) => !html.includes(cls))
assert.deepEqual(missing, [], `stylesheet classes missing from markup: ${missing.join(', ')}`)
ok('styles are exercised by the rendered markup (ensureStyles classes)')

console.log(`\nsmoke: ${n} groups passed`)
