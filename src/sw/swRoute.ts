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

export const staleCaches = (names: readonly string[], current: string): string[] => names.filter((n) => n.startsWith('sc-') && n !== current)
