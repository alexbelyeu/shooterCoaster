import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The watchdog and the status page run from a sparse checkout: a script they require that isn't in that list crashes
// every run ("Cannot find module './prod-alert.cjs'", 2026-11-10), and nothing else in CI runs them.
const root = join(__dirname, '..')

function sparseList(workflow: string): string[] {
  const yaml = readFileSync(join(root, '.github/workflows', workflow), 'utf8')
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

describe('sparse-checkout workflows', () => {
  it.each([
    ['studio-health.yml', 'scripts/studio-health.cjs'],
    ['studio-status.yml', 'scripts/studio-status.cjs'],
  ])('%s checks out every script %s requires', (workflow, script) => {
    const listed = new Set(sparseList(workflow))
    const missing = [...localRequires(script)].filter((f) => !listed.has(f))
    expect(missing).toEqual([])
  })
})
