import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// #1087: a merge left `<<<<<<<` / `=======` / `>>>>>>>` in docs/CODEMAP.md, which nothing else checks (tsc and
// ESLint fail them only in code). Every tracked text file is held to it.
const MARKER = /^(<{7}|>{7})( |$)/m

describe('conflict markers', () => {
  it('no tracked file has an unresolved merge conflict', () => {
    const files = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.ts', '*.tsx', '*.mjs', '*.cjs', '*.js', '*.json', '*.yml', '*.html', '*.css'], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
    const bad = files.filter((f) => MARKER.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
})
