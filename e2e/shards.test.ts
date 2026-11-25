import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAllLevels } from '@/levels/LevelRegistry'
import { NIGHTLY_PARTS, SHARDS, STEPS, STEP_LEVELS, nightlyOnly, planRun, stepLevelPairs } from './shards.mjs'

type Plan = { steps: Set<string>; levels: string[] | null }
type Pair = [string, string | null]
const root = path.resolve(__dirname, '..')
const levels = getAllLevels().map((l) => l.id)
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'budgets.json'), 'utf8'))
const shardNames = Object.keys(SHARDS)
const key = ([step, level]: Pair) => `${step}@${level ?? '-'}`
const full = (stepLevelPairs(planRun({ mobile: true }) as Plan, levels) as Pair[]).map(key)
const sharded = shardNames.flatMap((s) => stepLevelPairs(planRun({ shard: s }) as Plan, levels) as Pair[]).map(key)
const nightly = (nightlyOnly(levels) as Pair[]).map(key)

describe('smoke shards (#353, #372)', () => {
  it('run part of the full smoke, each step once; the full run makes the rest', () => {
    expect(new Set(full).size).toBe(full.length)
    expect(new Set(sharded).size).toBe(sharded.length)
    for (const p of sharded) expect(full).toContain(p)
    expect([...sharded, ...nightly].sort()).toEqual([...full].sort())
  })

  it('ride every level in the registry', () => {
    expect(sharded.filter((k) => k.startsWith('ride@')).sort()).toEqual(levels.map((l) => `ride@${l}`).sort())
  })

  it('keep the title, the phone run and the ride level-independent checks on the PR', () => {
    for (const k of ['title@-', 'mobile@-', 'shot@level1', 'results@level1']) expect(sharded).toContain(k)
  })

  it('leave the deep checks to the nightly run', () => {
    for (const k of ['boss@level2', 'wave@level2', 'pacing@level2', 'frenzy@level1', 'share@level1', 'pause@level1', 'daily@-', 'bossRush@-', 'mobileMenus@-'])
      expect(nightly).toContain(k)
  })

  it('each has a smokeSeconds budget, and every budget a shard', () => {
    const { _comment, ...seconds } = budgets.smokeSeconds
    expect(_comment).toBeTypeOf('string')
    expect(Object.keys(seconds).sort()).toEqual([...shardNames].sort())
    for (const s of Object.values(seconds)) expect(s).toBeGreaterThan(0)
  })

  it('are the matrix of the smoke job in ci.yml', () => {
    const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
    const line = ci.match(/^\s+shard: \[(.*)\]$/m)
    expect(line).not.toBeNull()
    expect(line![1].split(',').map((s) => s.trim()).sort()).toEqual([...shardNames].sort())
  })

  it('the nightly production smoke is the full run, in the parts of its matrix (#570)', () => {
    const pairsOf = (p: string) => (stepLevelPairs(planRun({ nightlyPart: p }) as Plan, levels) as Pair[]).map(key)
    const names = Object.keys(NIGHTLY_PARTS) as (keyof typeof NIGHTLY_PARTS)[]
    const parts = names.filter((p) => !('extra' in NIGHTLY_PARTS[p])).flatMap(pairsOf)
    expect(new Set(parts).size).toBe(parts.length)
    expect([...parts].sort()).toEqual([...full].sort())
    // An extra pass repeats steps of the full run under other conditions (the throttled `slow`, #539).
    for (const p of names.filter((n) => 'extra' in NIGHTLY_PARTS[n])) for (const k of pairsOf(p)) expect(full).toContain(k)
    const wf = fs.readFileSync(path.join(root, '.github/workflows/prod-smoke.yml'), 'utf8')
    const matrix = wf.match(/^\s+part: \[(.*)\]$/m)
    expect(matrix).not.toBeNull()
    expect(matrix![1].split(',').map((s) => s.trim()).sort()).toEqual(Object.keys(NIGHTLY_PARTS).sort())
    const combine = wf.match(/node scripts\/nightlyParts\.cjs \S+ \S+ (\S+)/)
    expect(combine![1].split(',').sort()).toEqual(Object.keys(NIGHTLY_PARTS).sort())
    const cmd = wf.match(/node e2e\/smoke\.mjs ([^\n]*)/)
    expect(cmd).not.toBeNull()
    expect(cmd![1]).toContain('--nightly-part "${{ matrix.part }}"')
    expect(cmd![1]).not.toMatch(/--(shard|steps|levels|skip-desktop)\b/)
  })
})

describe('the throttled nightly pass (#539)', () => {
  it('rides level1 and a boss level under cpu 4x, and gates programs after warm-up there and in pacing', () => {
    const slow = planRun({ nightlyPart: 'slow' })
    expect(slow.cpuThrottle).toBe(4)
    expect(slow.gatePrograms).toBe(true)
    expect(stepLevelPairs(slow as Plan, levels).map(key).sort()).toEqual(['results@level1', 'results@level3', 'ride@level1', 'ride@level3'])
    expect(planRun({ nightlyPart: 'pacing' }).gatePrograms).toBe(true)
    expect(planRun({ nightlyPart: 'main' })).toMatchObject({ cpuThrottle: 1, gatePrograms: false })
  })

  it('splits the rides between `main` and `rides`, a level added later going to `rides` (#1046)', () => {
    const withNew = [...levels, 'level99']
    const ridden = (p: string) => (stepLevelPairs(planRun({ nightlyPart: p }) as Plan, withNew) as Pair[]).filter(([s]) => s === 'ride').map(([, l]) => l)
    expect(ridden('main')).toEqual(['level1', 'level2', 'level3', 'level4'])
    expect([...ridden('main'), ...ridden('rides')]).toEqual(withNew)
  })

  it('leaves the PR shards ungated and unthrottled', () => {
    for (const s of shardNames) {
      const plan = planRun({ shard: s })
      expect(plan).not.toHaveProperty('gatePrograms')
      expect(plan).not.toHaveProperty('cpuThrottle')
    }
  })
})

describe('planRun', () => {
  it('runs every desktop step by default, the phone run with --mobile', () => {
    expect([...planRun().steps]).toEqual(STEPS.filter((s: string) => s !== 'mobile' && s !== 'mobileMenus'))
    expect(planRun({ mobile: true }).steps.has('mobileMenus')).toBe(true)
    expect([...planRun({ mobile: true, skipDesktop: true }).steps].sort()).toEqual(['mobile', 'mobileMenus', 'title'])
    expect([...planRun({ skipDesktop: true }).steps]).toEqual(['title'])
  })

  it('runs `dark` on the levels of the `switch` step whose page it shares', () => {
    expect(STEP_LEVELS.dark).toEqual(STEP_LEVELS.switch)
  })

  it('takes --steps and --levels', () => {
    const plan = planRun({ steps: 'ride,boss', levels: 'level2,level3' })
    expect([...plan.steps]).toEqual(['ride', 'boss'])
    expect(plan.levels).toEqual(['level2', 'level3'])
  })

  it('rejects unknown names and steps without the page they run on', () => {
    expect(() => planRun({ shard: 'nope' })).toThrow(/unknown shard/)
    expect(() => planRun({ steps: 'ride,bogus' })).toThrow(/unknown step/)
    expect(() => planRun({ steps: 'seed' })).toThrow(/needs "ride"/)
    expect(() => planRun({ steps: 'ride,share' })).toThrow(/needs "results"/)
    expect(() => planRun({ steps: 'ride,frenzy' })).toThrow(/needs "results"/)
    expect(() => planRun({ steps: 'mobileMenus' })).toThrow(/needs "mobile"/)
    expect(() => planRun({ shard: 'level2', levels: 'level3' })).toThrow(/drop --steps/)
    expect(() => planRun({ nightlyPart: 'nope' })).toThrow(/unknown nightly part/)
    expect(() => planRun({ nightlyPart: 'deep', levels: 'level1' })).toThrow(/drop --shard/)
  })
})
