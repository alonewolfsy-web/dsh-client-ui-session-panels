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
  'type.label': '右侧面板卡片插件',
  'guide.title': '右侧面板卡片插件',
  'guide.description': '上下文压力、缓存分析、轮次统计与 MCP 连接',
  'manage.open': '管理卡片',
  'manage.done': '完成',
  'titlebar.dragHint': '拖动标题栏调整卡片顺序',
  empty: '这个会话还没有可显示的数据',
  'section.context': '上下文',
  'section.turns': '轮次统计',
  'section.skills': '正在调用',
  'section.mcp': 'MCP 服务器',
  'usage.used': '已使用 {percent}',
  'row.window': '窗口',
  'row.measured': '实测占用',
  'row.projected': '预计占用',
  'row.system': '系统提示词',
  'row.toolDefs': '工具定义',
  'row.messages': '消息',
  'row.free': '剩余空间',
  'row.cacheHit': '缓存命中率',
  'row.uncached': '未缓存输入',
  'row.output': '输出',
  'row.cacheRead': '缓存读取',
  'row.cacheWrite': '缓存写入',
  'row.turns': '轮次',
  'row.steps': '步骤',
  'row.llm': '模型耗时',
  'row.tools': '工具耗时',
  'row.ttft': '首 token',
  'row.decode': '解码速率',
  'skills.none': '没有正在调用的技能',
  'skills.running': '运行中',
  'mcp.none': '没有配置 MCP 服务器',
  'mcp.reconnectTitle': '重连 {server}',
  'summary.turns': '{count} 轮',
  'summary.cache': '命中 {percent}',
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
assert.equal(tabDefinition.title(), '右侧面板卡片插件')
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
assert.equal(html.split('class="osp-titlebar"').length - 1, 4, 'expected exactly four title bars')
assert.ok(html.includes('osp-grip'), 'title bar grip missing')
assert.ok(html.includes('osp-tb-icon'), 'title bar icon missing')
assert.ok(html.includes('data-card-id="context"') && html.includes('data-card-id="mcp"'), 'card slots missing ids')
assert.ok(html.includes('拖动标题栏调整卡片顺序'), 'drag hint missing')
ok('title bars: four bars, grip, icon, drag hint, per-card drag slots')

/* context card numbers */
assert.ok(html.includes('已使用 6.4%'), 'usage headline missing (16384/256000 = 6.4%)')
assert.ok(html.includes('16.4K / 256K'), 'measured/window figures missing')
assert.ok(html.includes('命中 87.8%'), 'cache hit summary missing (88200/100500)')
assert.ok(html.includes('缓存命中率') && html.includes('87.8%'), 'cache hit row missing')
assert.ok(html.includes('>256K<'), 'window row missing')
assert.ok(html.includes('>16.4K<'), 'measured row missing')
assert.ok(html.includes('>18.2K<'), 'projected row missing')
assert.ok(html.includes('>12.1K<'), 'system tokens missing (12050)')
assert.ok(html.includes('>8.4K<'), 'tool tokens missing (8400)')
assert.ok(html.includes('>24.7K<'), 'message tokens missing (24700)')
assert.ok(html.includes('>211K<'), 'free tokens missing (256000-45150=210850)')
assert.ok(html.includes('>88.2K<'), 'cache read row missing')
assert.ok(html.includes('>12.3K<'), 'uncached input row missing')
assert.ok(html.includes('>4.1K<'), 'output tokens missing')
assert.ok(html.includes('>0<'), 'cache write row missing')
ok('context card: headline, window split, cache hit and token rows')

/* segment bar */
assert.ok(html.includes('osp-meter-stacked'), 'stacked bar missing')
assert.ok(html.includes('osp-meter-seg'), 'bar segments missing')
assert.ok(html.includes('系统提示词 4.7%'), 'system segment title missing (12050/256000)')
assert.ok(html.includes('剩余空间 82.4%'), 'free segment title missing (210850/256000)')
ok('context bar: four segments laid out by window share')

/* turns card */
assert.ok(html.includes('轮次统计'), 'turns section missing')
assert.ok(html.includes('3 轮'), 'turn summary missing')
assert.ok(html.includes('>3<') && html.includes('>12<'), 'turn/steps rows missing')
assert.ok(html.includes('1m 12s'), 'llm duration missing (72000ms)')
assert.ok(html.includes('34s'), 'tool duration missing (34200ms rounds to 34s over ten seconds)')
assert.ok(html.includes('800ms'), 'ttft missing (2400ms/3)')
assert.ok(html.includes('~41 tok/s'), 'decode rate missing (1681 tok / 41000ms)')
ok('turns card: stats, durations, ttft, decode rate')

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
const missing = ['osp-card', 'osp-mcp-row', 'osp-switch-btn', 'osp-usage-head', 'osp-summary', 'osp-titlebar'].filter((cls) => !html.includes(cls))
assert.deepEqual(missing, [], `stylesheet classes missing from markup: ${missing.join(', ')}`)
ok('styles are exercised by the rendered markup (ensureStyles classes)')

console.log(`\nsmoke: ${n} groups passed`)
