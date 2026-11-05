/**
 * Client plugin entry: registers one right-sidebar tab type.
 *
 * The tab is a page type (no resource patterns), so it is opened by kind — from
 * the guide capsule or the pane's add control — and every open shows the same
 * panels for the session the sidebar is bound to.
 *
 * Structured after the session-cards entry: register dictionaries, the tab
 * type, and its body — each inside a labelled effect, none allowed to throw
 * past apply, because one broken extension panel must not fail the web boot.
 */
import { SessionPanelsBody } from './panel'
import { en, zh } from './locales'

/** Re-exported so the smoke test can exercise the folds and reads without a browser. */
export {
  foldActiveSkills,
  foldActiveMcp,
  fetchMcpServers,
  reconnectMcpServer,
  splitMcpToolName,
  watchSessionActivity,
} from './folds'

/** Locale namespace owned by this plugin. */
const NS = 'sessionPanels'
/** Type discriminator; also what `openTab` names. */
const KIND = 'session-panels'
/** This implementation's identity, and the key its body registers under. */
const ID = 'dsh-client-ui-session-panels'

/** The tab type's registry definition. */
function definition(t: (key: string) => string) {
  return {
    id: ID,
    kind: KIND,
    priority: 'extension' as const,
    title: () => t('type.label'),
    guide: [
      {
        id: 'panels',
        order: 5,
        title: () => t('guide.title'),
        description: () => t('guide.description'),
      },
    ],
  }
}

/** Services this plugin's apply() reads; cordis refuses an undeclared service read. */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'sidebarRightTabs']

/**
 * Client plugin body: register the dictionaries, the tab type, and its body.
 * @param ctx - client root context carrying the registry, the slots and the locale service.
 */
export function apply(ctx: any): void {
  try {
    const t = ctx.locale.bind(NS)

    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-panels: dictionaries')

    ctx.effect(() => ctx.sidebarRightTabs.register(definition(t)), 'ui-session-panels: tab type')

    // The body needs the root context: the skills section follows the session
    // event stream, and Remote namespaces are read off ctx rather than composed
    // into props.
    const Body = (props: Record<string, unknown>) => <SessionPanelsBody {...(props as any)} client={ctx} />

    ctx.effect(
      () =>
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register(
            {
              name: 'sidebar.right.pane.tab',
              key: ID,
              locale: NS,
            },
            Body,
          ),
        ),
      'ui-session-panels: tab body',
    )
  } catch (error) {
    // Never rethrow: one broken extension panel must not fail the whole web boot.
    // eslint-disable-next-line no-console
    console.error('[session-panels] apply failed:', error instanceof Error ? error.stack : String(error))
  }
}
