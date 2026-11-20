import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs tooling module, no types
import { compareToBaseline, countTells, hasBlur, shadowLayers } from './uiTells.mjs'

describe('uiTells', () => {
  it('counts a blurred shadow as a glow and a hard one as fine', () => {
    expect(hasBlur('0 0 18px var(--accent-glow)')).toBe(true)
    expect(hasBlur('5px 6px 0 var(--fair-tar)')).toBe(false)
    expect(shadowLayers('1px 1px 0 rgb(1, 2, 3), 0 0 4px #000')).toHaveLength(2)
    const css = '.a { text-shadow: 3px 3px 0 #000, 0 0 12px rgba(255, 210, 63, 0.8); } .b { box-shadow: 0 5px 0 var(--x); }'
    expect(countTells(css, 'x.css').glow).toBe(1)
  })

  it('finds the other tells in CSS, and middle-dot strings in code but not in tests', () => {
    const css = `.c { border-top: 3px solid red; letter-spacing: 4px; text-transform: uppercase; border-radius: 999px;
      background: linear-gradient(135deg, #ffd700, #ff8c00); backdrop-filter: blur(10px); mask: radial-gradient(#000, #0000); }`
    expect(countTells(css, 'x.css')).toMatchObject({ edgeAccent: 1, tracking: 1, allCaps: 1, pill: 1, gradientSurface: 1, frosted: 1 })
    expect(countTells("const hint = 'Esc: resume · ↑↓ + Enter'", 'a.tsx').middleDot).toBe(1)
    expect(countTells("const hint = 'Esc: resume · ↑↓ + Enter'", 'a.test.ts').middleDot).toBe(0)
  })

  it('flags a count above the baseline and one below it (a stale baseline to lower)', () => {
    expect(compareToBaseline({ glow: 3, pill: 1, tracking: 2 }, { glow: 2, pill: 1, tracking: 4 })).toEqual({ over: ['glow'], under: ['tracking'] })
  })
})
