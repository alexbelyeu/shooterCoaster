import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BIOME_UI } from './theme'

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

/** --fair-tar, read from src/app/global.css: the letters on a level-select name plate. */
const css = readFileSync(new URL('../app/global.css', import.meta.url), 'utf8')
const TAR = css.match(/--fair-tar:\s*(#[0-9a-f]{6});/i)?.[1] ?? ''

describe('biome UI theme', () => {
  it('reads --fair-tar from the stylesheet', () => {
    expect(TAR).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("every world's name plate (its accent) reads at 4.5:1 or better under tar letters", () => {
    const low = Object.entries(BIOME_UI)
      .map(([biome, t]) => ({ biome, ratio: contrast(TAR, t.accent) }))
      .filter((r) => r.ratio < 4.5)
    expect(low).toEqual([])
  })
})
