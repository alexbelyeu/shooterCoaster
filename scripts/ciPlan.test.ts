import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import plan from './ciPlan.cjs'

const { ciPlan } = plan
const pr = (...files: string[]) => ciPlan({ event: 'pull_request', files })

describe('ciPlan', () => {
  it('a docs-only PR skips the game jobs and portal', () => {
    expect(pr('docs/agents/decisions/inbox/x.md', 'README.md')).toEqual({ game: false, unit: false, portal: false })
  })

  it('a docs-only PR touching scripts/ still runs the unit tests', () => {
    expect(pr('docs/x.md', 'scripts/README.md')).toEqual({ game: false, unit: true, portal: false })
  })

  it('code runs the full gate; portal only when one of its inputs changed', () => {
    expect(pr('src/app/App.tsx', 'docs/x.md')).toEqual({ game: true, unit: true, portal: false })
    expect(pr('e2e/smoke.mjs')).toEqual({ game: true, unit: true, portal: false })
    for (const f of ['vite.config.ts', 'index.html', 'public/404.html', 'scripts/portal/rules.mjs', 'package.json', 'package-lock.json', '.github/workflows/ci.yml']) {
      expect(pr(f), f).toEqual({ game: true, unit: true, portal: true })
    }
  })

  it('docs/audio/ is read by unit tests and the game, so it is not docs-only', () => {
    expect(pr('docs/audio/SCORE-FORMAT.md').game).toBe(true)
  })

  it('main runs the game jobs on every merge, portal nightly or when started by hand', () => {
    expect(ciPlan({ event: 'push' })).toEqual({ game: true, unit: true, portal: false })
    expect(ciPlan({ event: 'workflow_dispatch', merged: '#12 (abc1234)' })).toEqual({ game: true, unit: true, portal: false })
    expect(ciPlan({ event: 'workflow_dispatch' })).toEqual({ game: true, unit: true, portal: true })
    expect(ciPlan({ event: 'schedule' })).toEqual({ game: true, unit: true, portal: true })
  })

  it('ci.yml gates every job but the decider and the verify gate on the plan', () => {
    const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
    for (const [job, output] of [['unit', 'unit'], ['lighthouse', 'game'], ['smoke', 'game'], ['portal', 'portal']]) {
      const block = ci.split(/\n {2}(?=[a-z]+:\n)/).find((b) => b.startsWith(`${job}:`))!
      expect(block, job).toContain(`needs.changes.outputs.${output} == 'true'`)
    }
  })
})
