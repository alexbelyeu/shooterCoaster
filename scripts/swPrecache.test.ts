import { describe, expect, it } from 'vitest'
import { manifestLine, precacheList, readManifest } from './swPrecache.mjs'

const build = [
  '/index.html',
  '/404.html',
  '/sw.js',
  '/assets/index-Ab12Cd34.js',
  '/assets/index-Ef56Gh78.css',
  '/assets/world-desert-Ij90Kl12.js',
  '/assets/three-Mn34Op56.js',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-maskable-512.png',
  '/poster/title-landscape.webp',
  '/poster/title-portrait.webp',
  '/fonts/ultra-latin-400.woff2',
  '/fonts/OFL-Lobster.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/social/og-1200x630.jpg',
]

describe('precacheList', () => {
  const list = precacheList(build)

  it('takes every hashed bundle, so every level plays offline', () => {
    expect(list.filter((f: string) => f.startsWith('/assets/'))).toEqual(build.filter((f) => f.startsWith('/assets/')).sort())
  })

  it('takes the page and what its first paint loads: poster, fonts, icons, manifest', () => {
    for (const f of ['/index.html', '/site.webmanifest', '/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-maskable-512.png', '/poster/title-landscape.webp', '/poster/title-portrait.webp', '/fonts/ultra-latin-400.woff2']) {
      expect(list).toContain(f)
    }
  })

  it('never the 404 page, the worker, crawl files, the share card or licences', () => {
    for (const f of ['/404.html', '/sw.js', '/robots.txt', '/sitemap.xml', '/social/og-1200x630.jpg', '/fonts/OFL-Lobster.txt']) expect(list).not.toContain(f)
  })

  it('is sorted whatever order the build lists its files in', () => {
    expect(precacheList([...build].reverse())).toEqual(list)
  })
})

describe('manifestLine', () => {
  it('reads back what it writes, at the head of the bundled worker', () => {
    const files = precacheList(build)
    expect(readManifest(manifestLine(files, 'sc-0123abcd') + '(()=>{self.addEventListener("fetch",()=>{})})();')).toEqual({ files, cache: 'sc-0123abcd' })
    expect(readManifest('(()=>{})();')).toBeNull()
  })
})
