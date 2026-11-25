/**
 * The service worker (#999), bundled into `dist/sw.js` by `vite.config.ts`, whose first line declares the two constants
 * below. A deploy's worker takes over at once and drops the old build's cache, with no update prompt: the page is
 * network-first, so an online load runs the deployed build whichever worker answers (decisions inbox, #999).
 */
import { cacheable, keepAtRuntime, SHELL, staleCaches, swRoute } from './swRoute'

declare const SC_PRECACHE: string[]
declare const SC_CACHE: string

// The worker globals this file uses, without the `webworker` lib (it conflicts with `DOM` in one program).
interface SwEvent extends Event {
  waitUntil(work: Promise<unknown>): void
}
interface SwFetchEvent extends SwEvent {
  request: Request
  respondWith(answer: Promise<Response>): void
}
interface SwScope {
  location: Location
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  addEventListener(type: 'install' | 'activate', listener: (e: SwEvent) => void): void
  addEventListener(type: 'fetch', listener: (e: SwFetchEvent) => void): void
}

const sw = self as unknown as SwScope
const origin = sw.location.origin
const precached = new Set(SC_PRECACHE)

sw.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SC_CACHE)
      // Unhashed files bypass the HTTP cache, which may still hold the last deploy's.
      .then((cache) => cache.addAll(SC_PRECACHE.map((f) => new Request(f, { cache: f.startsWith('/assets/') ? 'default' : 'reload' }))))
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(staleCaches(names, SC_CACHE).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim()),
  )
})

// Offline, the page is the one this worker precached, never one fetched since: it always matches this cache's bundles.
async function fromNetworkThenShell(request: Request): Promise<Response> {
  try {
    return await fetch(request)
  } catch (err) {
    const shell = await caches.match(SHELL, { cacheName: SC_CACHE })
    if (shell) return shell
    throw err
  }
}

async function fromCacheThenNetwork(request: Request): Promise<Response> {
  const hit = await caches.match(request, { cacheName: SC_CACHE })
  if (hit) return hit
  const res = await fetch(request)
  if (cacheable(res) && keepAtRuntime(request.url, precached)) {
    const copy = res.clone()
    void caches.open(SC_CACHE).then((cache) => cache.put(request, copy))
  }
  return res
}

sw.addEventListener('fetch', (e) => {
  const { request } = e
  const route = swRoute(request, origin, precached)
  if (route === 'shell') e.respondWith(fromNetworkThenShell(request))
  else if (route === 'cache') e.respondWith(fromCacheThenNetwork(request))
})
