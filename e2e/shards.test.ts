import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAllLevels } from '@/levels/LevelRegistry'
import { SHARDS, STEPS, planRun, stepLevelPairs } from './shards.mjs'

type Plan = { steps: Set<string>; levels: string[] | null }
const root = path.resolve(__dirname, '..')
const levels = getAllLevels().map((l) => l.id)
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'budgets.json'), 'utf8'))
const shardNames = Object.keys(SHARDS)
const key = ([step, level]: [string, string | null]) => `${step}@${level ?? '-'}`

describe('smoke shards (#353)', () => {
  it('together run exactly what the full smoke runs, each step once', () => {
    const full = stepLevelPairs(planRun({ mobile: true }) as Plan, levels).map(key).sort()
    const sharded = shardNames.flatMap((s) => stepLevelPairs(planRun({ shard: s }) as Plan, levels)).map(key).sort()
    expect(sharded).toEqual(full)
    expect(new Set(full).size).toBe(full.length)
    expect(full).toContain('ride@level1')
  })

  it('ride every level in the registry', () => {
    const ridden = shardNames.flatMap((s) => (planRun({ shard: s }) as Plan).levels ?? [])
    expect([...new Set(ridden)].sort()).toEqual([...levels].sort())
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
})

describe('planRun', () => {
  it('runs every desktop step by default, the phone run with --mobile', () => {
    expect([...planRun().steps]).toEqual(STEPS.filter((s: string) => s !== 'mobile'))
    expect(planRun({ mobile: true }).steps.has('mobile')).toBe(true)
    expect([...planRun({ mobile: true, skipDesktop: true }).steps].sort()).toEqual(['mobile', 'title'])
  })

  it('takes --steps and --levels', () => {
    const plan = planRun({ steps: 'ride,boss', levels: 'level2,level3' })
    expect([...plan.steps]).toEqual(['ride', 'boss'])
    expect(plan.levels).toEqual(['level2', 'level3'])
  })

  it('rejects unknown names and steps without the ride they need', () => {
    expect(() => planRun({ shard: 'nope' })).toThrow(/unknown shard/)
    expect(() => planRun({ steps: 'ride,bogus' })).toThrow(/unknown step/)
    expect(() => planRun({ steps: 'seed' })).toThrow(/needs "ride"/)
    expect(() => planRun({ shard: 'level2', levels: 'level3' })).toThrow(/drop --steps/)
  })
})
