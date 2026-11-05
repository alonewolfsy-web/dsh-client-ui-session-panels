/**
 * Unit assertions for the pure client logic, run against an esbuild bundle —
 * no react, no host services, no browser.
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = resolve(root, '.tmp')
await mkdir(outdir, { recursive: true })

await build({
  entryPoints: [resolve(root, 'src/client/logic.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: resolve(outdir, 'logic.cjs'),
  logLevel: 'warning',
})

const require = createRequire(import.meta.url)
const {
  fmtTokens,
  fmtPercent,
  fmtDuration,
  fmtRate,
  computeCacheHit,
  contextSegments,
  pressurePercent,
  splitMcpToolName,
  foldActiveSkills,
  foldActiveMcp,
  fetchMcpServers,
  reconnectMcpServer,
  readLayout,
  writeLayout,
  moveCard,
  CARD_IDS,
} = require(resolve(outdir, 'logic.cjs'))

let n = 0
const ok = (label) => console.log(`  ok ${++n}: ${label}`)

/* ---- fmtTokens ---- */
assert.equal(fmtTokens(940), '940')
assert.equal(fmtTokens(12300), '12.3K')
assert.equal(fmtTokens(105000), '105K')
assert.equal(fmtTokens(1050000), '1.05M')
assert.equal(fmtTokens(undefined), '—')
assert.equal(fmtTokens(-5), '0')
ok('fmtTokens compact forms and edges')

/* ---- fmtPercent ---- */
assert.equal(fmtPercent(6.4), '6.4%')
assert.equal(fmtPercent(1200), '999.0%')
assert.equal(fmtPercent(undefined), '—')
ok('fmtPercent clamps runaway readings')

/* ---- fmtDuration / fmtRate ---- */
assert.equal(fmtDuration(840), '840ms')
assert.equal(fmtDuration(1200), '1.2s')
assert.equal(fmtDuration(72000), '1m 12s')
// Rounding must carry into the next minute, never print "1m 60s"
assert.equal(fmtDuration(119700), '2m 0s')
assert.equal(fmtDuration(179950), '3m 0s')
assert.equal(fmtDuration(0), '—')
assert.equal(fmtRate(1681, 41000), '~41 tok/s')
assert.equal(fmtRate(100, 0), '—')
ok('fmtDuration and fmtRate')

/* ---- computeCacheHit (ported from openchamber computeCacheHitRate) ---- */
let hit = computeCacheHit({ uncachedInputTokens: 12300, outputTokens: 4100, cacheReadTokens: 88200, cacheWriteTokens: 0 })
assert.equal(hit.hasInput, true)
assert.equal(Math.round(hit.percent * 10) / 10, 87.8) // 88200 / 100500
assert.deepEqual(computeCacheHit({}), { percent: 0, hasInput: false })
assert.deepEqual(computeCacheHit(undefined), { percent: 0, hasInput: false })
assert.equal(computeCacheHit({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 200, cacheWriteTokens: 0 }).percent, 100)
assert.equal(computeCacheHit({ uncachedInputTokens: 100, outputTokens: 0, cacheReadTokens: -50, cacheWriteTokens: 0 }).percent, 0)
ok('cache hit: ported formula, hasInput flag, clamps')

/* ---- contextSegments ---- */
let seg = contextSegments({ contextWindow: 256000 }, { systemTokens: 12050, toolsTokens: 8400, messageTokens: 24700 })
assert.equal(seg.total, 256000)
assert.equal(seg.free, 256000 - 45150)
ok('segments: window is the denominator, free is the remainder')

seg = contextSegments({ contextWindow: 100 }, { systemTokens: 12050, toolsTokens: 0, messageTokens: 0 })
assert.equal(seg.total, 12050)
assert.equal(seg.free, 0)
ok('segments: split past the window grows the total')

seg = contextSegments({}, { systemTokens: 500, toolsTokens: 0, messageTokens: 0 })
assert.equal(seg.total, 500)
assert.equal(seg.free, 0)
ok('segments: unknown window, the split is its own denominator')

assert.equal(contextSegments({}, {}), null)
ok('segments: nothing to draw yields null')

/* ---- pressurePercent ---- */
assert.equal(pressurePercent({ pressureTokens: 16384, projectedTokens: 18200, contextWindow: 256000 }), 16384 / 256000 * 100)
assert.equal(pressurePercent({ pressureTokens: 16384 }), null)
assert.equal(pressurePercent({ pressureTokens: 999999999, contextWindow: 100 }), 100)
ok('pressure percent: measured over window, clamped, null without window')

/* ---- splitMcpToolName ---- */
assert.deepEqual(splitMcpToolName('mcp__context7__resolve-library-id'), { server: 'context7', tool: 'resolve-library-id' })
assert.deepEqual(splitMcpToolName('mcp__plain'), { server: 'plain', tool: '' })
assert.equal(splitMcpToolName('not-mcp'), null)
assert.equal(splitMcpToolName('mcp__'), null)
ok('splitMcpToolName')

/* ---- foldActiveSkills ---- */
let skills = []
skills = foldActiveSkills(skills, { type: 'user/message', data: { source: { kind: 'skill-invocation', name: 'review' } } })
assert.deepEqual(skills, ['review'])
skills = foldActiveSkills(skills, { type: 'tool/call', data: { name: 'skill', arguments: '{"name":"debug"}' } })
assert.deepEqual(skills, ['review', 'debug'])
const same = foldActiveSkills(skills, { type: 'tool/call', data: { name: 'skill', arguments: { name: 'debug' } } })
assert.equal(same, skills) // duplicate: same array, caller can skip re-render
skills = foldActiveSkills(skills, { type: 'turn/end' })
assert.deepEqual(skills, [])
ok('skills fold: both entrances, duplicate stability, turn boundary clears')

/* ---- foldActiveMcp ---- */
let calls = []
calls = foldActiveMcp(calls, { type: 'tool/call', data: { callId: 'c1', name: 'mcp__context7__resolve' } })
assert.deepEqual(calls, [{ id: 'c1', server: 'context7', tool: 'resolve' }])
calls = foldActiveMcp(calls, { type: 'tool/ptc-dispatch-start', data: { subCallId: 'c2', name: 'mcp__server2__query' } })
assert.equal(calls.length, 2)
calls = foldActiveMcp(calls, { type: 'tool/result', data: { message: { toolCallId: 'c1' } } })
assert.deepEqual(calls, [{ id: 'c2', server: 'server2', tool: 'query' }])
const untouched = foldActiveMcp(calls, { type: 'message/updated', data: {} })
assert.equal(untouched, calls) // unknown event: same array
calls = foldActiveMcp(calls, { type: 'tool/ptc-dispatch', data: { subCallId: 'c2' } })
assert.deepEqual(calls, [])
calls = foldActiveMcp([{ id: 'c3', server: 's', tool: 't' }], { type: 'turn/start' })
assert.deepEqual(calls, [])
ok('mcp fold: open via callId/subCallId, close via result/ptc, turn boundary clears')

/* ---- fetchMcpServers / reconnectMcpServer against a fake fetcher ---- */
const fakeResponse = (body) => ({ ok: true, json: async () => body })
let fetchedPath = null
const fetcher = async (path, init) => {
  fetchedPath = { path, init: init ?? {} }
  if (path.startsWith('/session-panels/mcp/reconnect')) {
    return fakeResponse({ servers: [{ id: 'ctx7', server: 'context7', transport: 'http', target: 'https://x', state: 'active', tools: 3, connected: true }] })
  }
  return fakeResponse({ servers: [{ id: 'ctx7', server: 'context7', transport: 'http', target: 'https://x', state: 'active', tools: 3, connected: true }, { id: 'x', server: 'y', state: 'idle' }] })
}
let servers = await fetchMcpServers(fetcher)
assert.equal(fetchedPath.path, '/session-panels/mcp')
assert.equal(servers.length, 2)
assert.equal(servers[1].tools, null) // missing tools → null, not 0
assert.equal(servers[1].connected, false) // idle falls back to not connected
servers = await reconnectMcpServer(fetcher, 'ctx7')
assert.equal(fetchedPath.path, '/session-panels/mcp/reconnect?id=ctx7')
assert.equal(fetchedPath.init.method, 'POST')
assert.equal(servers[0].connected, true)
ok('host fetchers: /session-panels routes, POST reconnect, payload narrowing')

const badFetcher = async () => ({ ok: false, status: 500, json: async () => ({}) })
await assert.rejects(fetchMcpServers(badFetcher), /http-500/)
// Node ships a global fetch; hide it to prove the no-fetch guard.
const realFetch = globalThis.fetch
globalThis.fetch = undefined
try {
  await assert.rejects(fetchMcpServers(undefined), /unavailable/)
} finally {
  globalThis.fetch = realFetch
}
ok('fetchers reject on http errors and missing fetch')

/* ---- layout: persistence + normalization ---- */
assert.deepEqual(CARD_IDS, ['context', 'turns', 'skills', 'mcp'])
const order = moveCard([...CARD_IDS], 'context', 'mcp')
assert.deepEqual(order, ['turns', 'skills', 'context', 'mcp']) // insert before the target, per session-cards semantics
assert.deepEqual(moveCard(order, 'context', 'context'), order)
// No localStorage in node: readLayout falls back to the default layout.
const layout = readLayout()
assert.deepEqual(layout.order, [...CARD_IDS])
assert.deepEqual(layout.hidden, [])
writeLayout(layout) // must not throw without localStorage
ok('layout: moveCard, node fallback default, write without storage is safe')

console.log(`\nunit: ${n} groups passed`)
