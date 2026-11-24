import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compile } from '../src/audio/scrim/score'
import { minifyScrim } from './scrimMinify.mjs'

const DIR = new URL('../src/audio/scores/', import.meta.url)
const FILES = [
  ...readdirSync(DIR).filter((f) => f.endsWith('.scrim')),
  ...readdirSync(new URL('themes/', DIR)).filter((f) => f.endsWith('.scrim')).map((f) => `themes/${f}`),
]

/** The compiled song without what minifying may change: source line numbers and the `about` notes. */
function played(text: string): unknown {
  return JSON.parse(JSON.stringify(compile(text), (key, value) => (key === 'ln' || key === 'line' || key === 'about' ? undefined : value)))
}

describe('minifyScrim', () => {
  it('finds every score', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(12)
  })

  it.each(FILES)('%s compiles to the same song, and shorter', (file) => {
    const text = readFileSync(new URL(file, DIR), 'utf8')
    const min = minifyScrim(text)
    expect(compile(min).errors).toEqual([])
    expect(played(min)).toEqual(played(text))
    expect(min.length).toBeLessThan(text.length)
  })

  it('keeps a sharp, drops a comment, the about line and spacing, and keeps a voice named about', () => {
    expect(minifyScrim('about  notes here\n  # a comment\nvoice lead   square  vol=0.6 # loud\nlead | F#4- .  |\nabout | C4 |\n')).toBe(
      'voice lead square vol=0.6\nlead | F#4- . |\nabout | C4 |',
    )
  })
})
