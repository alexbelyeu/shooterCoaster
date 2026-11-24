import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { compile } from '../src/audio/scrim/score'
import { stripScrim } from './scrimStrip.mjs'

const SCORES = path.resolve(__dirname, '../src/audio/scores')
const files = [
  ...fs.readdirSync(SCORES).filter((f) => f.endsWith('.scrim')),
  ...fs.readdirSync(path.join(SCORES, 'themes')).map((f) => `themes/${f}`),
]
// Line numbers only label errors; `about` is the one field stripped on purpose
const comparable = (text: string) => JSON.stringify(compile(text), (key, value) => (key === 'ln' || key === 'about' ? undefined : value))

describe('stripScrim', () => {
  it('drops comments, the about line and empty lines, keeping a sharp note', () => {
    expect(stripScrim('title T\nabout prose # here\n\n# a note\nlead | C#4 D # trailing\n  bass | C2')).toBe('title T\nlead | C#4 D\nbass | C2')
  })

  it('collapses spacing and keeps a voice named about', () => {
    expect(stripScrim('voice lead   square  vol=0.6 # loud\nabout | C4 |\n')).toBe('voice lead square vol=0.6\nabout | C4 |')
  })

  it.each(files)('%s compiles to the same song stripped', (file) => {
    const text = fs.readFileSync(path.join(SCORES, file), 'utf8')
    const stripped = stripScrim(text)
    expect(stripped.length).toBeLessThan(text.length)
    expect(comparable(stripped)).toBe(comparable(text))
  })
})
