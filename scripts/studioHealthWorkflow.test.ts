import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The watchdog runs from a sparse checkout: a script it requires that isn't in that list crashes every run
// ("Cannot find module './prod-alert.cjs'", 2026-11-10), and nothing else in CI runs the watchdog.
const root = join(__dirname, '..')

function sparseList(): string[] {
  const yaml = readFileSync(join(root, '.github/workflows/studio-health.yml'), 'utf8')
  const block = yaml.split('sparse-checkout: |')[1].split('sparse-checkout-cone-mode')[0]
  return block.split('\n').map((l) => l.trim()).filter(Boolean)
}

function localRequires(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  const src = readFileSync(join(root, file), 'utf8')
  for (const m of src.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)) localRequires(`scripts/${m[1]}`, seen)
  return seen
}

describe('studio-health workflow', () => {
  it('checks out every script the watchdog requires', () => {
    const listed = new Set(sparseList())
    const missing = [...localRequires('scripts/studio-health.cjs')].filter((f) => !listed.has(f))
    expect(missing).toEqual([])
  })
})
