/**
 * Session activity: folding the event stream into "what is running right now",
 * and the MCP status rows served by this plugin's host half.
 *
 * The skills fold and the MCP call lifetime are ported from the session-cards
 * card set — they are the proven reading of the stream's event types:
 *
 * - A skill enters via `/name` (a user message with a skill-invocation source)
 *   or via the `skill` tool, and leaves at the next turn boundary.
 * - An MCP call has a real lifetime: `tool/call` opens it (or
 *   `tool/ptc-dispatch-start` for calls nested in run_code), and the matching
 *   result closes it — not the turn end.
 *
 * Numbers never come from here: projections carry every figure the cards show.
 */

/** Tool names an MCP tool registry publishes, `mcp__<server>__<tool>`. */
const MCP_PREFIX = 'mcp__'

/** How far back the opening snapshot replays, in messages. */
const WATCH_WINDOW = 500

/** The status route this plugin's host half publishes. */
const MCP_STATUS_PATH = '/session-panels/mcp'

/** The reconnect route; `?id=<entry id>` names the row to restart. */
const MCP_RECONNECT_PATH = '/session-panels/mcp/reconnect'

/** One in-flight MCP call, in start order. */
export interface McpCall {
  id: string
  server: string
  tool: string
}

/** What is running right now, for the two activity cards. */
export interface Activity {
  skills: string[]
  calls: McpCall[]
}

export const NO_ACTIVITY: Activity = { skills: [], calls: [] }

/** One configured MCP server, as the host half reports it. */
export interface McpServer {
  id: string
  server: string
  transport: string
  target: string
  state: string
  tools: number | null
  connected: boolean
}

type Fetcher = (input: string, init?: any) => Promise<any>

/** The parts of the client context the activity watcher touches. */
export interface ClientContext {
  remote?: {
    session?: {
      follow?: (
        request: {
          address: { kind: 'session'; sessionId: string }
          assistantStream?: boolean
          maxMessages?: number
        },
        signal?: AbortSignal,
      ) => AsyncIterable<any>
    }
  }
}

/** Split an MCP tool name into its server and tool halves. */
export function splitMcpToolName(name: unknown): { server: string; tool: string } | null {
  if (typeof name !== 'string' || !name.startsWith(MCP_PREFIX)) return null
  const rest = name.slice(MCP_PREFIX.length)
  if (rest === '') return null
  const at = rest.indexOf('__')
  return at < 0 ? { server: rest, tool: '' } : { server: rest.slice(0, at), tool: rest.slice(at + 2) }
}

/**
 * Fold one session event into the set of skills currently in flight.
 *
 * `turn/start` and `turn/end` clear the set: a skill runs inside one turn, and
 * nothing from a finished turn is still running. Unknown shapes pass through
 * untouched, so a host adding new event types never breaks the fold.
 *
 * @param names - current skill names.
 * @param event - raw session event.
 * @returns the same array when nothing changed, so callers can skip a re-render.
 */
export function foldActiveSkills(names: string[], event: any): string[] {
  if (event === null || typeof event !== 'object') return names

  if (event.type === 'turn/start' || event.type === 'turn/end') {
    return names.length === 0 ? names : []
  }

  const name = invokedSkillName(event)
  if (name === null || names.includes(name)) return names
  return [...names, name]
}

/** The skill one event proves is being invoked, or `null` for any other event. */
function invokedSkillName(event: any): string | null {
  // A `/name` gesture: the host injects the skill body as a user message.
  if (event.type === 'user/message') {
    const source = event.data?.source
    if (source?.kind !== 'skill-invocation') return null
    return typeof source.name === 'string' && source.name !== '' ? source.name : null
  }

  // The model loading a skill through the `skill` tool.
  if (event.type === 'tool/call' && event.data?.name === 'skill') {
    const args = parseToolArguments(event.data.arguments ?? event.data.input)
    const name = args?.name
    return typeof name === 'string' && name !== '' ? name : null
  }

  return null
}

/** Tool arguments arrive as an object, or as the model's raw JSON string. */
function parseToolArguments(raw: unknown): { name?: unknown } | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'object') return raw as { name?: unknown }
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as { name?: unknown }) : undefined
  } catch {
    return undefined
  }
}

/**
 * Fold one session event into the set of MCP calls on the wire.
 *
 * Unlike a skill, an MCP call has a real lifetime, and the stream brackets it:
 *
 * - A call made from inside `run_code` is recorded as `tool/ptc-dispatch-start`
 *   with a `subCallId`, and closed by `tool/ptc-dispatch` carrying that id.
 * - A call made as a top-level tool is a `tool/call` with a `callId`, closed by
 *   the `tool/result` whose message answers that id.
 *
 * So the row disappears when the call returns, not when the turn ends.
 * `turn/start` and `turn/end` still clear the set: a stream opened mid-turn
 * must not inherit a call whose result fell outside the window.
 *
 * @param calls - current calls, in start order.
 * @param event - raw session event; unknown shapes pass through untouched.
 * @returns the same array when nothing changed, so callers can skip a re-render.
 */
export function foldActiveMcp(calls: McpCall[], event: any): McpCall[] {
  if (event === null || typeof event !== 'object') return calls

  if (event.type === 'turn/start' || event.type === 'turn/end') {
    return calls.length === 0 ? calls : []
  }

  const started = startedMcpCall(event)
  if (started !== null) {
    if (calls.some((call) => call.id === started.id)) return calls
    return [...calls, started]
  }

  const finished = finishedMcpCallId(event)
  if (finished === null) return calls
  const next = calls.filter((call) => call.id !== finished)
  return next.length === calls.length ? calls : next
}

/** The MCP call an event opens, or `null` when it opens none. */
function startedMcpCall(event: any): McpCall | null {
  if (event.type === 'tool/ptc-dispatch-start') return mcpCall(event.data?.subCallId, event.data?.name)
  if (event.type === 'tool/call') return mcpCall(event.data?.callId, event.data?.name)
  return null
}

/** The call id an event closes, or `null` when it closes nothing. */
function finishedMcpCallId(event: any): string | null {
  if (event.type === 'tool/ptc-dispatch') return idOrNull(event.data?.subCallId)
  if (event.type === 'tool/result') {
    // The tool message carries the id it answers; `source.callId` is the same
    // value on older records, so either one closes the row.
    const message = event.data?.message
    return idOrNull(message?.toolCallId) ?? idOrNull(message?.source?.callId) ?? idOrNull(event.data?.callId)
  }
  return null
}

/** Pair a call id with a name, keeping only calls that are actually MCP tools. */
function mcpCall(id: unknown, name: unknown): McpCall | null {
  const key = idOrNull(id)
  if (key === null) return null
  const parts = splitMcpToolName(name)
  return parts === null ? null : { id: key, ...parts }
}

function idOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Follow a session's event stream, reporting the work in flight as it changes.
 *
 * The opening `snapshot` frame seeds the state from the events the host already
 * has, so a panel mounted mid-turn shows what that turn loaded. Every later
 * `event` frame is folded in as it arrives — no polling, one stream for both
 * activity cards.
 *
 * @param client - root client context carrying `remote.session`.
 * @param sessionId - session whose stream is followed.
 * @param signal - caller lifetime; aborts the follow and ends the loop.
 * @param onActivity - called with the new state whenever either list changes.
 * @returns resolves when the stream ends; rejects with `unavailable` without a host stream.
 */
export async function watchSessionActivity(
  client: ClientContext | undefined,
  sessionId: string,
  signal: AbortSignal | undefined,
  onActivity: (activity: Activity) => void,
): Promise<void> {
  const session = client?.remote?.session
  if (!sessionId || typeof session?.follow !== 'function') throw new Error('unavailable')

  let activity = NO_ACTIVITY
  const stream = session.follow(
    { address: { kind: 'session', sessionId }, assistantStream: true, maxMessages: WATCH_WINDOW },
    signal,
  )

  /** Fold one event into both lists; false when neither list moved. */
  const fold = (event: any): boolean => {
    const skills = foldActiveSkills(activity.skills, event)
    const calls = foldActiveMcp(activity.calls, event)
    if (skills === activity.skills && calls === activity.calls) return false
    activity = { skills, calls }
    return true
  }

  for await (const frame of stream) {
    // The seed frame: replay what the host already recorded, so a panel mounted
    // while a skill or MCP call is running still reports it.
    if (frame?.type === 'snapshot') {
      activity = NO_ACTIVITY
      for (const record of frame.records ?? []) fold(record?.event)
      onActivity(activity)
      continue
    }

    if (frame?.type !== 'event') continue
    if (fold(frame.event)) onActivity(activity)
  }

  // The stream itself is over (the session closed): nothing is in flight
  // anymore, and a stale row must not outlive its stream. Skipped when the
  // caller aborted: a host that RETURNS (rather than throws) on abort would
  // otherwise deliver this reset after the next session's snapshot and erase
  // its rows.
  if (!signal?.aborted) onActivity(NO_ACTIVITY)
}

/**
 * Fetch the MCP status rows from this plugin's host half.
 * @param fetcher - fetch implementation; defaults to the global one.
 * @param signal - caller lifetime.
 */
export async function fetchMcpServers(fetcher: Fetcher | undefined, signal?: AbortSignal): Promise<McpServer[]> {
  return readStatus(await request(fetcher, MCP_STATUS_PATH, { signal }))
}

/**
 * Restart one server's connection through the host's reconnect route.
 * @param fetcher - fetch implementation; defaults to the global one.
 * @param id - loader entry id of the server to restart.
 * @param signal - caller lifetime.
 * @returns the server list as it stands right after the restart.
 */
export async function reconnectMcpServer(
  fetcher: Fetcher | undefined,
  id: string,
  signal?: AbortSignal,
): Promise<McpServer[]> {
  const path = `${MCP_RECONNECT_PATH}?id=${encodeURIComponent(id)}`
  return readStatus(await request(fetcher, path, { method: 'POST', signal }))
}

/** One request to the host half, with a message worth showing on failure. */
async function request(fetcher: Fetcher | undefined, path: string, init: any): Promise<any> {
  const call = fetcher ?? (globalThis as { fetch?: Fetcher }).fetch
  if (typeof call !== 'function') throw new Error('unavailable')
  const response = await call(path, { credentials: 'same-origin', ...init })
  if (!response.ok) throw new Error(`http-${response.status}`)
  return response.json()
}

/** Narrow a status payload, ignoring anything the host did not send. */
function readStatus(payload: any): McpServer[] {
  const rows = Array.isArray(payload?.servers) ? payload.servers : []
  return rows
    .filter((row: any) => row && typeof row.id === 'string' && typeof row.server === 'string')
    .map((row: any) => {
      const state = typeof row.state === 'string' ? row.state : 'unknown'
      const tools = typeof row.tools === 'number' ? row.tools : null
      return {
        id: row.id,
        server: row.server,
        transport: typeof row.transport === 'string' ? row.transport : '',
        target: typeof row.target === 'string' ? row.target : '',
        state,
        tools,
        // Older host halves omit the field; fall back to the same rule they use.
        connected:
          typeof row.connected === 'boolean' ? row.connected : state === 'active' && tools !== 0,
      }
    })
}
