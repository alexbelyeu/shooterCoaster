import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BIOME_UI, FAIR } from './theme'

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The letters on a level-select name plate. */
const TAR = FAIR.tar

describe('biome UI theme', () => {
  it("every world's name plate (its accent) reads at 4.5:1 or better under tar letters", () => {
    const low = Object.entries(BIOME_UI)
      .map(([biome, t]) => ({ biome, ratio: contrast(TAR, t.accent) }))
      .filter((r) => r.ratio < 4.5)
    expect(low).toEqual([])
  })
})

describe('the fair palette', () => {
  it('is the --fair-* colours of src/app/global.css', () => {
    const css = readFileSync(new URL('../app/global.css', import.meta.url), 'utf8')
    for (const [name, hex] of Object.entries(FAIR)) {
      const token = `--fair-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
      expect(new RegExp(`${token}:\\s*([^;]+);`).exec(css)?.[1], token).toBe(hex)
    }
  })

  it("the score card's lettering reads at 4.5:1 or better on what it sits on", () => {
    const pairs: [string, string, string][] = [
      ['cream on the board', FAIR.cream, FAIR.oxblood],
      ['gilt on the board', FAIR.gilt, FAIR.oxblood],
      ['tar on the Daily Run card', FAIR.tar, FAIR.sky],
      ['oxblood on the World card', FAIR.oxblood, FAIR.cream],
    ]
    const low = pairs.map(([what, ink, ground]) => ({ what, ratio: contrast(ink, ground) })).filter((p) => p.ratio < 4.5)
    expect(low).toEqual([])
  })
})
