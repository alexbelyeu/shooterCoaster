import { describe, expect, it } from 'vitest'
import { MAX_FILES, portalProblems } from './rules.mjs'

const html = (text: string) => ({ path: 'index.html', bytes: text.length, text })
const ok = html('<script type="module" src="./assets/index.js"></script><link rel="icon" href="./favicon.ico">')

describe('portalProblems', () => {
  it('passes a relative build', () => {
    const css = { path: 'assets/index.css', bytes: 10, text: "@font-face{src:url(../fonts/inter.woff2)}" }
    const js = { path: 'assets/index.js', bytes: 10, text: 'a.href="https://github.com/alexbelyeu/shooterCoaster"' }
    expect(portalProblems([ok, css, js, { path: 'fonts/inter.woff2', bytes: 48000 }])).toEqual([])
  })

  it('needs index.html at the zip root', () => {
    expect(portalProblems([{ ...ok, path: 'game/index.html' }])).toEqual(['no index.html at the root'])
  })

  it('rejects root-absolute and protocol-relative paths in HTML and CSS', () => {
    expect(portalProblems([html('<script src="/assets/index.js"></script>')])[0]).toMatch(/root-absolute/)
    expect(portalProblems([html('<link href="//cdn.example/x.css">')])[0]).toMatch(/root-absolute/)
    const css = { path: 'assets/a.css', bytes: 1, text: "src:url('/fonts/inter.woff2')" }
    expect(portalProblems([ok, css])).toEqual(["assets/a.css: root-absolute reference `url('/`"])
  })

  it('rejects other-origin URLs in HTML and CSS, and third-party hosts anywhere', () => {
    expect(portalProblems([html('<meta property="og:image" content="https://scoaster.com/og.jpg">')])[0]).toMatch(/other-origin/)
    const js = { path: 'assets/a.js', bytes: 1, text: 'fetch("https://www.googletagmanager.com/gtag/js")' }
    expect(portalProblems([ok, js])).toEqual(['assets/a.js: references googletagmanager'])
    const css = { path: 'a.css', bytes: 1, text: "@import url('https://fonts.googleapis.com/css2?family=Lobster')" }
    expect(portalProblems([ok, css])).toHaveLength(2)
  })

  it('caps the file count', () => {
    const many = Array.from({ length: MAX_FILES }, (_, i) => ({ path: `f${i}`, bytes: 1 }))
    expect(portalProblems([ok, ...many])).toEqual([`${MAX_FILES + 1} files (limit ${MAX_FILES})`])
  })
})
