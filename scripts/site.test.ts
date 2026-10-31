import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// What scoaster.com serves around the game (#193); the limits come from docs/marketing/SEO.md.

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file))
const html = read('index.html').toString()
const vercel = JSON.parse(read('vercel.json').toString()) as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

/** Vercel `source` patterns as used here: literal paths plus `(.*)` groups (path-to-regexp). */
function sourceRegex(source: string): RegExp {
  expect(source.replace(/\(\.\*\)/g, '')).toMatch(/^[\w/.-]*$/)
  return new RegExp(`^${source.replace(/[.]/g, '\\.').replace(/\\\.\*/g, '.*')}$`)
}

/** Vercel's order for a static build: a file in the output, else the first matching rewrite, else 404.html with a 404. */
function route(pathname: string, files: Set<string>): { status: number; serves: string } {
  const file = pathname === '/' ? '/index.html' : pathname
  if (files.has(file)) return { status: 200, serves: file }
  for (const { source, destination } of vercel.rewrites) {
    const match = pathname.match(sourceRegex(source))
    if (!match) continue
    const target = destination.replace(/\$(\d)/g, (_, i) => match[Number(i)])
    if (target.startsWith('/api/')) return { status: 200, serves: `function ${target}` }
    if (files.has(target)) return { status: 200, serves: target }
  }
  return { status: 404, serves: '/404.html' }
}

function headersFor(pathname: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rule of vercel.headers) {
    if (sourceRegex(rule.source).test(pathname)) for (const h of rule.headers) out[h.key] = h.value
  }
  return out
}

/** Every file of public/ as it lands in dist/, plus the built page and one hashed bundle. */
function siteFiles(): Set<string> {
  const files = fs
    .readdirSync(path.join(root, 'public'), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => '/' + path.relative(path.join(root, 'public'), path.join(d.parentPath, d.name)).split(path.sep).join('/'))
  return new Set([...files, '/index.html', '/assets/index-Ab12Cd34.js'])
}

function meta(attr: 'name' | 'property', key: string): string | undefined {
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]
}

function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString()).toBe('PNG')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf: Buffer) {
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error('no SOF marker')
}

describe('vercel.json routing', () => {
  const files = siteFiles()

  it('serves the game at / and the /go/<campaign> paths, and the API as functions', () => {
    expect(route('/', files)).toEqual({ status: 200, serves: '/index.html' })
    expect(route('/go/share', files)).toEqual({ status: 200, serves: '/index.html' })
    expect(route('/go/reddit-launch', files)).toEqual({ status: 200, serves: '/index.html' })
    expect(route('/api/daily', files)).toEqual({ status: 200, serves: 'function /api/daily' })
  })

  it('answers unknown paths with a real 404, not the game', () => {
    for (const p of ['/nope', '/level1', '/index.php', '/go', '/social/missing.jpg']) {
      expect(route(p, files)).toEqual({ status: 404, serves: '/404.html' })
    }
    expect(files.has('/404.html')).toBe(true)
  })

  it('serves the crawl and share files as themselves', () => {
    for (const p of ['/robots.txt', '/sitemap.xml', '/site.webmanifest', '/favicon.ico', '/social/og-1200x630.jpg']) {
      expect(route(p, files).serves).toBe(p)
    }
  })

  it('sends the security headers everywhere and caches only hashed bundles forever (public/ has no assets/ folder)', () => {
    for (const p of ['/', '/go/share', '/assets/index-Ab12Cd34.js', '/404.html']) {
      const h = headersFor(p)
      expect(h['X-Content-Type-Options']).toBe('nosniff')
      expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
      expect(h['Permissions-Policy']).toContain('camera=()')
    }
    expect(headersFor('/assets/index-Ab12Cd34.js')['Cache-Control']).toContain('immutable')
    for (const p of ['/', '/favicon.ico', '/fonts/inter-latin-wght.woff2', '/site.webmanifest']) {
      expect(headersFor(p)['Cache-Control']).toBeUndefined()
    }
    expect(fs.existsSync(path.join(root, 'public/assets'))).toBe(false)
    expect(headersFor('/api/daily')['X-Robots-Tag']).toBe('noindex')
    expect(headersFor('/')['X-Robots-Tag']).toBeUndefined()
  })
})

describe('share card (as an unfurler reads index.html)', () => {
  it('has every tag the unfurlers need, filled in', () => {
    for (const key of ['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:secure_url', 'og:image:alt']) {
      expect(meta('property', key), key).toBeTruthy()
    }
    for (const key of ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
      expect(meta('name', key), key).toBeTruthy()
    }
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    expect(meta('property', 'og:locale')).toBe('en_US')
  })

  it('agrees with itself and the canonical URL, alt within X\'s 420 chars', () => {
    const image = meta('property', 'og:image')
    expect(image).toMatch(/^https:\/\/scoaster\.com\//)
    expect(meta('property', 'og:image:secure_url')).toBe(image)
    expect(meta('name', 'twitter:image')).toBe(image)
    expect(meta('name', 'twitter:image:alt')).toBe(meta('property', 'og:image:alt'))
    expect(meta('property', 'og:url')).toBe(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1])
    expect(meta('name', 'twitter:image:alt')!.length).toBeLessThanOrEqual(420)
    expect(meta('name', 'robots')).toBe('max-image-preview:large')
  })

  it('keeps the tags inside the first 300 KB of the page (WhatsApp)', () => {
    expect(html.indexOf('</head>')).toBeGreaterThan(0)
    expect(Buffer.byteLength(html.slice(0, html.indexOf('</head>')))).toBeLessThan(300 * 1024)
  })

  it('points at a wide JPEG of the stated size, ≥ 1200 px and under WhatsApp\'s 600 KB', () => {
    const file = new URL(meta('property', 'og:image')!).pathname
    const jpg = read(path.join('public', file))
    const { width, height } = jpegSize(jpg)
    expect(meta('property', 'og:image:type')).toBe('image/jpeg')
    expect(`${width}x${height}`).toBe(`${meta('property', 'og:image:width')}x${meta('property', 'og:image:height')}`)
    expect(width).toBeGreaterThanOrEqual(1200)
    expect(width / height).toBeGreaterThan(1.8)
    expect(width / height).toBeLessThan(2.1)
    expect(jpg.length).toBeLessThan(600 * 1024)
  })
})

describe('web app manifest and icons', () => {
  const manifest = JSON.parse(read('public/site.webmanifest').toString())

  it('is linked from the page and matches its colours', () => {
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest" />')
    expect(manifest.theme_color).toBe(meta('name', 'theme-color'))
    expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'fullscreen', name: 'ShooterCoaster' })
  })

  it('lists 192, 512 and a maskable 512 PNG, each the size it claims', () => {
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']))
    for (const icon of manifest.icons) {
      const { width, height } = pngSize(read(path.join('public', icon.src)))
      expect(`${width}x${height}`).toBe(icon.sizes)
    }
  })

  it('links favicons that exist, a 180 px touch icon and a 16/32/48 .ico', () => {
    for (const href of html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)) {
      expect(fs.existsSync(path.join(root, 'public', href[1])), href[1]).toBe(true)
    }
    expect(pngSize(read('public/apple-touch-icon.png'))).toEqual({ width: 180, height: 180 })
    const ico = read('public/favicon.ico')
    expect(ico.readUInt16LE(2)).toBe(1)
    expect([...Array(ico.readUInt16LE(4)).keys()].map((i) => ico[6 + 16 * i])).toEqual([16, 32, 48])
  })
})

describe('404 page', () => {
  const page = read('public/404.html').toString()

  it('is noindex, links home and loads nothing from another origin', () => {
    expect(page).toContain('<meta name="robots" content="noindex" />')
    expect(page).toContain('<html lang="en">')
    expect(page).toMatch(/<a href="\/">[^<]+<\/a>/)
    expect(page).not.toMatch(/https?:\/\//)
  })
})
