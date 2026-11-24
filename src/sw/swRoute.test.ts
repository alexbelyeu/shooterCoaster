import { describe, expect, it } from 'vitest'
import { cacheable, keepAtRuntime, staleCaches, swRoute } from './swRoute'

const origin = 'https://scoaster.com'
const precached = new Set(['/index.html', '/assets/index-Ab12.js', '/fonts/ultra-latin-400.woff2', '/poster/title-portrait.webp'])
const get = (path: string, mode = 'cors') => swRoute({ url: origin + path, method: 'GET', mode }, origin, precached)

describe('swRoute', () => {
  it('never answers /api/* from the cache, whatever the method or mode', () => {
    for (const path of ['/api/leaderboard?level=level1', '/api/telemetry', '/api/leaderboard?daily=2026-11-24']) {
      for (const mode of ['cors', 'navigate', 'no-cors', 'same-origin']) expect(get(path, mode)).toBe('network')
      expect(swRoute({ url: origin + path, method: 'POST', mode: 'cors' }, origin, precached)).toBe('network')
    }
  })

  it('takes the page from the network first on a navigation to /, /index.html or a /go/ landing path', () => {
    for (const path of ['/', '/?e2e=1', '/index.html', '/go/reddit-launch', '/go/share?utm_source=share']) expect(get(path, 'navigate')).toBe('shell')
  })

  it('lets a script fetch of the page reach the server (the stale-build check)', () => {
    expect(get('/', 'cors')).toBe('network')
    expect(get('/index.html', 'same-origin')).toBe('network')
  })

  it('serves hashed bundles and precached files from the cache first', () => {
    expect(get('/assets/index-Ab12.js')).toBe('cache')
    expect(get('/assets/world-desert-Zz99.js')).toBe('cache')
    expect(get('/fonts/ultra-latin-400.woff2')).toBe('cache')
    expect(get('/poster/title-portrait.webp', 'no-cors')).toBe('cache')
  })

  it('leaves everything else alone: other origins, other methods, unknown paths, the worker itself', () => {
    expect(swRoute({ url: 'https://example.com/assets/x.js', method: 'GET', mode: 'cors' }, origin, precached)).toBe('network')
    expect(swRoute({ url: origin + '/assets/index-Ab12.js', method: 'HEAD', mode: 'cors' }, origin, precached)).toBe('network')
    for (const path of ['/sw.js', '/robots.txt', '/social/og-1200x630.jpg', '/404.html']) expect(get(path)).toBe('network')
    expect(get('/level1', 'navigate')).toBe('network')
  })
})

describe('cacheable', () => {
  it('stores only a whole same-origin 200', () => {
    expect(cacheable({ status: 200, type: 'basic', redirected: false })).toBe(true)
    expect(cacheable({ status: 404, type: 'basic', redirected: false })).toBe(false)
    expect(cacheable({ status: 206, type: 'basic', redirected: false })).toBe(false)
    expect(cacheable({ status: 200, type: 'opaque', redirected: false })).toBe(false)
    expect(cacheable({ status: 200, type: 'basic', redirected: true })).toBe(false)
  })
})

describe('keepAtRuntime', () => {
  it('never stores a page fetched at runtime: a shell from another build would sit next to this build’s chunks', () => {
    for (const path of ['/', '/index.html', '/go/reddit-launch']) expect(keepAtRuntime(origin + path, precached)).toBe(false)
  })

  it('stores back only files this worker precached, never another build’s bundles', () => {
    expect(keepAtRuntime(origin + '/assets/index-Ab12.js', precached)).toBe(true)
    expect(keepAtRuntime(origin + '/fonts/ultra-latin-400.woff2', precached)).toBe(true)
    expect(keepAtRuntime(origin + '/assets/index-Cd34.js', precached)).toBe(false)
    expect(keepAtRuntime(origin + '/assets/world-desert-Zz99.js', precached)).toBe(false)
  })
})

describe('staleCaches', () => {
  it('names every older build cache and nothing else', () => {
    expect(staleCaches(['sc-old1', 'sc-new', 'sc-old2', 'other-app'], 'sc-new')).toEqual(['sc-old1', 'sc-old2'])
  })
})
