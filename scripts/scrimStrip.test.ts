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
    expect(stripScrim('title T\nabout prose # here\n\n# a note\nlead | C#4 D # trailing\n  bass | C2')).toBe('title T\nlead | C#4 D\n  bass | C2')
  })

  it.each(files)('%s compiles to the same song stripped', (file) => {
    const text = fs.readFileSync(path.join(SCORES, file), 'utf8')
    const stripped = stripScrim(text)
    expect(stripped.length).toBeLessThan(text.length)
    expect(comparable(stripped)).toBe(comparable(text))
  })
})
