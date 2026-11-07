import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAllLevels } from '@/levels/LevelRegistry'
import { SHARDS, STEPS, nightlyOnly, planRun, stepLevelPairs } from './shards.mjs'

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
    for (const k of ['boss@level2', 'wave@level2', 'frenzy@level1', 'share@level1', 'pause@level1', 'daily@-', 'mobileMenus@-'])
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

  it('the nightly production smoke is the full run', () => {
    const wf = fs.readFileSync(path.join(root, '.github/workflows/prod-smoke.yml'), 'utf8')
    const cmd = wf.match(/node e2e\/smoke\.mjs ([^\n]*)/)
    expect(cmd).not.toBeNull()
    expect(cmd![1]).toContain('--mobile')
    expect(cmd![1]).not.toMatch(/--(shard|steps|levels|skip-desktop)\b/)
  })
})

describe('planRun', () => {
  it('runs every desktop step by default, the phone run with --mobile', () => {
    expect([...planRun().steps]).toEqual(STEPS.filter((s: string) => s !== 'mobile' && s !== 'mobileMenus'))
    expect(planRun({ mobile: true }).steps.has('mobileMenus')).toBe(true)
    expect([...planRun({ mobile: true, skipDesktop: true }).steps].sort()).toEqual(['mobile', 'mobileMenus', 'title'])
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
  })
})
