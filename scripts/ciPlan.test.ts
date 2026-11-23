import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import plan from './ciPlan.cjs'

const { ciPlan, BIOME_LEVEL } = plan
const pr = (...files: string[]) => ciPlan({ event: 'pull_request', files })

describe('ciPlan', () => {
  it('a docs-only PR skips the game jobs and portal', () => {
    expect(pr('docs/agents/decisions/inbox/x.md', 'README.md')).toMatchObject({ game: false, unit: false, portal: false })
  })

  it('a docs-only PR touching scripts/ still runs the unit tests', () => {
    expect(pr('docs/x.md', 'scripts/README.md')).toMatchObject({ game: false, unit: true, portal: false })
  })

  it('code runs the full gate; portal only when one of its inputs changed', () => {
    expect(pr('src/app/App.tsx', 'docs/x.md')).toMatchObject({ game: true, unit: true, portal: false })
    expect(pr('e2e/smoke.mjs')).toMatchObject({ game: true, unit: true, portal: false })
    for (const f of ['vite.config.ts', 'index.html', 'public/404.html', 'scripts/portal/rules.mjs', 'package.json', 'package-lock.json', '.github/workflows/ci.yml']) {
      expect(pr(f), f).toMatchObject({ game: true, unit: true, portal: true })
    }
  })

  it('docs/audio/ is read by unit tests and the game, so it is not docs-only', () => {
    expect(pr('docs/audio/SCORE-FORMAT.md').game).toBe(true)
  })

  it('main runs the game jobs on every merge, portal nightly or when started by hand', () => {
    expect(ciPlan({ event: 'push' })).toMatchObject({ game: true, unit: true, portal: false })
    expect(ciPlan({ event: 'workflow_dispatch', merged: '#12 (abc1234)' })).toMatchObject({ game: true, unit: true, portal: false })
    expect(ciPlan({ event: 'workflow_dispatch' })).toMatchObject({ game: true, unit: true, portal: true })
    expect(ciPlan({ event: 'schedule' })).toMatchObject({ game: true, unit: true, portal: true })
  })

  it('ci.yml gates every job but the decider and the verify gate on the plan', () => {
    const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
    for (const [job, output] of [['unit', 'unit'], ['lighthouse', 'game'], ['smoke', 'game'], ['portal', 'portal']]) {
      const block = ci.split(/\n {2}(?=[a-z]+:\n)/).find((b) => b.startsWith(`${job}:`))!
      expect(block, job).toContain(`needs.changes.outputs.${output} == 'true'`)
    }
  })

  it('runs pacing for the levels a PR touches: its biome folder, or every level for shared ride / spawn code', () => {
    expect(pr('src/levels/environments/biomes/gym/gymTrack.ts', 'src/levels/environments/biomes/gym/gymTrack.test.ts').pacing).toEqual(['level6'])
    expect(pr('src/levels/environments/biomes/desert/Desert.tsx', 'src/levels/environments/biomes/ocean/x.ts').pacing).toEqual(['level2', 'level3'])
    expect(pr('src/track/rideV2.ts').pacing).toHaveLength(6)
    expect(pr('src/levels/LevelRegistry.ts').pacing).toHaveLength(6)
    expect(pr('src/track/rideV2.test.ts', 'src/ui/HUD.tsx').pacing).toEqual([])
    expect(pr('docs/x.md').pacing).toEqual([])
    expect(ciPlan({ event: 'push' }).pacing).toEqual([])
  })

  it('maps every level\'s biome folder', async () => {
    const { getAllLevels } = await import('@/levels/LevelRegistry')
    expect(Object.fromEntries(getAllLevels().map((l) => [l.biome, l.id]))).toEqual(BIOME_LEVEL)
  })
})
