/** How the service worker (#999) answers a request: `network` leaves it alone, `shell` is network-first with the cached page as fallback, `cache` is cache-first. */

export type SwRoute = 'network' | 'shell' | 'cache'

export interface SwRequest {
  url: string
  method: string
  mode: string
}

export const SHELL = '/index.html'

const isShellPath = (path: string) => path === '/' || path === SHELL || path.startsWith('/go/')

export function swRoute({ url, method, mode }: SwRequest, origin: string, precached: ReadonlySet<string>): SwRoute {
  if (method !== 'GET') return 'network'
  const { origin: from, pathname } = new URL(url)
  if (from !== origin || pathname.startsWith('/api/')) return 'network'
  // A fetch of the page itself (`app/staleReload.ts` asks whether a deploy happened) must reach the server.
  if (isShellPath(pathname)) return mode === 'navigate' ? 'shell' : 'network'
  return pathname.startsWith('/assets/') || precached.has(pathname) ? 'cache' : 'network'
}

export const cacheable = (res: Pick<Response, 'status' | 'type' | 'redirected'>): boolean =>
  res.status === 200 && res.type === 'basic' && !res.redirected

/**
 * Whether a response fetched at runtime may go into this worker's cache: only a file this worker precached (an entry
 * evicted since install), never the page. The cache then only ever holds this build, so an offline load gets a shell
 * whose chunks are all there; an online navigation answered by the last deploy's worker can't plant the new build's
 * `index.html` next to the old build's chunks (QA on #1003).
 */
export const keepAtRuntime = (url: string, precached: ReadonlySet<string>): boolean => {
  const { pathname } = new URL(url)
  return !isShellPath(pathname) && precached.has(pathname)
}

export const staleCaches = (names: readonly string[], current: string): string[] => names.filter((n) => n.startsWith('sc-') && n !== current)
