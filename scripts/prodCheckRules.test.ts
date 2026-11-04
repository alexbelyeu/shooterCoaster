import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { assetRefs, assetStem, missingAssets, responseProblems } from './prodCheckRules.mjs'

const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8'))
const OK_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'cross-origin-opener-policy': 'same-origin',
}
const res = (headers: Record<string, string>, status = 200) => ({ status, bytes: 10, headers: { ...OK_HEADERS, ...headers } })

describe('asset names', () => {
  it('drops the Vite hash, also one starting with a dash', () => {
    expect(assetStem('/assets/tone-BAgUArOt.js')).toBe('tone.js')
    expect(assetStem('/assets/index--u4UeygU.js')).toBe('index.js')
    expect(assetStem('/assets/index-CN52d6WT.css')).toBe('index.css')
    expect(assetStem('/fonts/inter-latin-wght.woff2')).toBe('inter-latin-wght.woff2')
  })

  it('finds the chunk, stylesheet and font paths a page or chunk references', () => {
    const html = '<script type="module" src="/assets/index--u4UeygU.js"></script><link href="/assets/index-CN52d6WT.css">'
    const js = 'const m=["assets/tone-BAgUArOt.js","assets/synth-D6aK86_v.js"];import("./x.js");const u="https://scoaster.com/social/og.jpg"'
    const css = '@font-face{src:url(/fonts/lobster-latin-400.woff2)}'
    expect([...assetRefs(html), ...assetRefs(js), ...assetRefs(css)]).toEqual([
      '/assets/index--u4UeygU.js', '/assets/index-CN52d6WT.css', '/assets/tone-BAgUArOt.js', '/assets/synth-D6aK86_v.js', '/fonts/lobster-latin-400.woff2',
    ])
  })

  it('reports local chunks the deploy lacks by stem, whatever their deployed hash', () => {
    const local = ['/assets/tone-AAAAAAAA.js', '/assets/index-BBBBBBBB.js', '/assets/index-CCCCCCCC.css']
    expect(missingAssets(local, ['/assets/tone-ZZZZZZZZ.js', '/assets/index-YYYYYYYY.js', '/assets/index-XXXXXXXX.css'])).toEqual([])
    expect(missingAssets(local, ['/assets/index-YYYYYYYY.js', '/assets/index-XXXXXXXX.css'])).toEqual(['/assets/tone-AAAAAAAA.js'])
    expect(missingAssets(['/assets/a-AAAAAAAA.js', '/assets/a-BBBBBBBB.js'], ['/assets/a-CCCCCCCC.js'])).toEqual(['/assets/a-BBBBBBBB.js'])
  })
})

describe('responseProblems', () => {
  it('passes a hashed chunk cached forever and a page that revalidates', () => {
    const immutable = { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=31536000, immutable' }
    expect(responseProblems('/assets/tone-BAgUArOt.js', res(immutable), vercel)).toEqual([])
    expect(responseProblems('/', res({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' }), vercel)).toEqual([])
    expect(responseProblems('/fonts/inter-latin-wght.woff2', res({ 'content-type': 'font/woff2' }), vercel)).toEqual([])
  })

  it('catches a chunk answered with HTML, a missing cache rule, a long cache on an unhashed file and a missing header', () => {
    expect(responseProblems('/assets/tone-BAgUArOt.js', res({ 'content-type': 'text/html', 'cache-control': 'public, max-age=31536000, immutable' }), vercel))
      .toEqual(['/assets/tone-BAgUArOt.js: content-type "text/html"'])
    expect(responseProblems('/assets/tone-BAgUArOt.js', res({ 'content-type': 'text/javascript', 'cache-control': 'public, max-age=0' }), vercel))
      .toEqual(['/assets/tone-BAgUArOt.js: Cache-Control "public, max-age=0" (want "public, max-age=31536000, immutable")'])
    expect(responseProblems('/site.webmanifest', res({ 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=31536000, immutable' }), vercel))
      .toEqual(['/site.webmanifest: unhashed file cached long ("public, max-age=31536000, immutable")'])
    const { 'cross-origin-opener-policy': _, ...noCoop } = res({ 'content-type': 'image/png' }).headers
    expect(responseProblems('/icons/icon-192.png', { status: 200, bytes: 10, headers: noCoop }, vercel))
      .toEqual(['/icons/icon-192.png: Cross-Origin-Opener-Policy "" (want "same-origin")'])
  })

  it('checks the status first, and a 404 page against its own status', () => {
    expect(responseProblems('/assets/gone-AAAAAAAA.js', res({}, 404), vercel)).toEqual(['/assets/gone-AAAAAAAA.js: HTTP 404 (want 200)'])
    expect(responseProblems('/nope', res({ 'content-type': 'text/html' }, 404), vercel, 404)).toEqual([])
  })
})
