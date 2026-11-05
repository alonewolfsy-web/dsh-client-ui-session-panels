/**
 * Host half: MCP connection status and a reconnect switch for the panels.
 *
 * The browser cannot read this state on its own. Every MCP server is a loader
 * entry running `@deepseek-ai/dsh-mcp-client`; whether its transport is up lives
 * in that entry's fiber, and the tool count lives in the tool registry. Both are
 * host-side objects with no projection or Remote namespace behind them, so this
 * plugin publishes the smallest surface that makes the MCP card real:
 *
 * - `GET  /session-panels/mcp`             → each configured server and its state
 * - `POST /session-panels/mcp/reconnect?id=` → dispose and re-apply one entry
 *
 * The routes live on the same origin as the Web GUI, so the panel fetches a
 * relative path: no second port, no CORS, and nothing written to the session
 * log (a status read is not a user action and must not look like one).
 *
 * Ported from the session-cards host half; only the plugin identity and the
 * route paths differ, so the two plugins can coexist without colliding.
 *
 * Two rules keep this safe:
 *
 * - Nothing here writes configuration. Reconnecting disposes the running fiber
 *   and re-applies the same entry, so `cordis.patch.yml` — comments included —
 *   is never rewritten and a crash between steps cannot leave a server disabled.
 * - A route handler never throws past the response. A failed reconnect is
 *   reported in the payload; the web server would otherwise answer 400 and the
 *   card could only say "unknown".
 */

/** The plugin every MCP server row runs. One entry per server. */
const MCP_PLUGIN = '@deepseek-ai/dsh-mcp-client'

/** Status route; the panel fetches this path relative to its own origin. */
const STATUS_PATH = '/session-panels/mcp'

/** Reconnect route; `?id=<entry id>` names the row to restart. */
const RECONNECT_PATH = '/session-panels/mcp/reconnect'

/**
 * Fiber states, by the numeric values cordis assigns. Anything else means the
 * entry has not been started yet, which reads as "not connected" to the panel.
 */
const FIBER_STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

export const name = 'ui-session-panels'

/**
 * The loader owns the MCP rows and the tool registry holds their tools; nothing
 * below works without either. The web server is optional and injected lazily,
 * so a profile without one still loads this plugin.
 */
export const inject = ['loader', 'tools']

/**
 * Describe one MCP entry for the panel.
 * @param entry - a loader entry.
 * @param ctx - host context used to count the server's registered tools.
 * @returns the row the panel renders.
 */
function describeEntry(entry, ctx) {
  const options = entry.options ?? {}
  const config = options.config ?? {}
  const server = String(config.serverName ?? options.id ?? 'mcp')
  const state = stateOf(entry)
  const tools = countTools(ctx, server)

  return {
    id: String(options.id ?? server),
    server,
    transport: String(config.transport ?? ''),
    target: targetOf(config),
    state,
    tools,
    connected: isConnected(state, tools),
  }
}

/**
 * Whether a server can actually serve, as opposed to merely being started.
 *
 * The fiber state only says the plugin loaded. `mcp-client` tolerates a failed
 * startup (`failOnStartupError: false`) and keeps retrying in the background, so
 * a server that never reached its backend still reads `active` — and stays that
 * way after the client gives up. The registered tool count is the one piece of
 * evidence the host has that a connection was established, so an `active` entry
 * with zero tools is reported as not connected: a card that says "connected" for
 * a server with nothing to run is telling the user a link exists when it does
 * not.
 *
 * This is deliberately conservative in one direction only: a server that is
 * genuinely connected but publishes no tools also reads as not connected, which
 * is the same advice ("reconnect") either way.
 *
 * @param state - the entry's fiber state.
 * @param tools - registered tool count, or `null` when the registry is unreadable.
 * @returns true only when the connection is known to work.
 */
export function isConnected(state, tools) {
  if (state !== 'active') return false
  // An unreadable registry is not evidence of failure; zero tools is.
  return tools !== 0
}

/** Where the server points, in one line, for the row's tooltip. */
function targetOf(config) {
  if (typeof config.url === 'string' && config.url !== '') return config.url
  const command = typeof config.command === 'string' ? config.command : ''
  const args = Array.isArray(config.args) ? config.args.map((arg) => String(arg)) : []
  return [command, ...args].filter((part) => part !== '').join(' ')
}

/** The entry's connection state, as the panel spells it. */
function stateOf(entry) {
  if (entry.disabled) return 'disabled'
  const state = entry.fiber?.state
  return typeof state === 'number' ? (FIBER_STATES[state] ?? 'unknown') : 'idle'
}

/**
 * Count the tools a server currently has registered.
 *
 * This is the evidence {@link isConnected} reads. A server that is connected but
 * publishes no tools and one whose transport never came up look identical from
 * here, and both mean the same thing to the panel: nothing to run.
 *
 * @returns the count, or `null` when the tool registry is not readable.
 */
function countTools(ctx, server) {
  const registry = ctx.tools
  if (!registry || typeof registry.schemas !== 'function') return null
  const prefix = `mcp__${server}__`
  let count = 0
  try {
    for (const schema of registry.schemas()) {
      if (typeof schema?.name === 'string' && schema.name.startsWith(prefix)) count += 1
    }
  } catch {
    return null
  }
  return count
}

/** Every configured MCP server, in a stable order. */
function snapshot(ctx) {
  const servers = []
  for (const entry of ctx.loader.entries()) {
    if (entry?.options?.name !== MCP_PLUGIN) continue
    servers.push(describeEntry(entry, ctx))
  }
  servers.sort((left, right) => left.server.localeCompare(right.server))
  return servers
}

/**
 * Restart one server's connection.
 *
 * Disposing the fiber closes the transport and unregisters the server's tools.
 * The loader treats a self-disposing plugin as "switched off" and marks the
 * entry disabled in memory (it also asks the tree to write, which for a patch
 * layer leaves the file's own `disabled` key alone), so the mark is cleared
 * before re-applying: reconnecting means "start it again", not "turn it off".
 *
 * The entry's options are otherwise never touched, so the profile keeps the
 * exact configuration — and comments — the user wrote.
 *
 * @param entry - the MCP entry to restart.
 * @returns nothing; the caller re-reads the snapshot to report the outcome.
 */
async function reconnect(entry) {
  const fiber = entry.fiber
  if (fiber) {
    try {
      fiber.dispose()
      await fiber.await?.()
    } catch {
      // A fibre that is already tearing down still leaves us free to re-apply.
    }
  }
  if (entry.options.disabled === true) entry.options.disabled = false
  await entry.init()
}

/** Write one JSON response. */
function send(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

/** Read `?id=` off a request URL. */
function idOf(req) {
  try {
    return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('id')
  } catch {
    return null
  }
}

/**
 * Register the status and reconnect routes.
 * @param ctx - host context carrying the loader.
 */
export function apply(ctx) {
  // Optional: a profile without a web server simply has no route to serve, and
  // that must not stop the plugin (or the app boot) from loading.
  ctx.inject(['webServer'], (scope) => {
    scope.effect(
      () =>
        scope.webServer.register({
          kind: 'exact',
          path: STATUS_PATH,
          handler: (req, res) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              send(res, 405, { error: 'method-not-allowed' })
              return
            }
            try {
              send(res, 200, { servers: snapshot(ctx) })
            } catch (error) {
              // A 5xx, not a 200 carrying an error field: the client's fetchers
              // reject on http errors and the card then reads "status unknown".
              // An empty 200 would read as "no MCP servers configured".
              send(res, 500, { error: messageOf(error) })
            }
          },
        }),
      'session-panels: mcp status route',
    )

    scope.effect(
      () =>
        scope.webServer.register({
          kind: 'exact',
          path: RECONNECT_PATH,
          handler: async (req, res) => {
            if (req.method !== 'POST') {
              send(res, 405, { error: 'method-not-allowed' })
              return
            }
            const id = idOf(req)
            const entry = id === null ? undefined : findEntry(ctx, id)
            if (!entry) {
              send(res, 404, { error: 'unknown-server', id })
              return
            }
            if (entry.disabled) {
              // Starting a row the profile turned off would disagree with the
              // configuration the user can read; report it instead.
              send(res, 409, { error: 'disabled', id, servers: snapshot(ctx) })
              return
            }
            try {
              await reconnect(entry)
            } catch (error) {
              // The server may still be retrying; report the row, not a 400.
              send(res, 200, { servers: snapshot(ctx), error: messageOf(error) })
              return
            }
            send(res, 200, { servers: snapshot(ctx) })
          },
        }),
      'session-panels: mcp reconnect route',
    )
  })
}

/** Resolve an MCP entry by id, refusing anything that is not one. */
function findEntry(ctx, id) {
  for (const entry of ctx.loader.entries()) {
    if (entry?.options?.id === id && entry.options.name === MCP_PLUGIN) return entry
  }
  return undefined
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
