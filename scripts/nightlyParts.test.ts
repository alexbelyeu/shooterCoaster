import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import parts from './nightlyParts.cjs'
import alert from './prod-alert.cjs'

const pass = (id: string) => ({ id, ok: true, problems: [] })
const fail = (id: string, problem: string) => ({ id, ok: false, problems: [problem] })

describe('combine (#570)', () => {
  it('is green only when every part is', () => {
    const { exitCode, results } = parts.combine([
      { name: 'main', exitCode: 0, results: [pass('title')] },
      { name: 'deep', exitCode: 0, results: [pass('boss')] },
    ], 60)
    expect(exitCode).toBe(0)
    expect(results.map((r: { id: string }) => r.id)).toEqual(['title', 'boss'])
  })

  it('keeps a red part\'s failed checks for the alert', () => {
    const combined = parts.combine([
      { name: 'main', exitCode: 0, results: [pass('title')] },
      { name: 'deep', exitCode: 1, results: [fail('boss', 'no kill')] },
    ], 60)
    expect(combined.exitCode).toBe(1)
    expect(alert.whatHappened({ exitCode: combined.exitCode, capMinutes: 60, results: combined.results })).toContain('**boss**: no kill')
  })

  it('names a part that hit the cap, and still lists what failed elsewhere', () => {
    const combined = parts.combine([
      { name: 'main', exitCode: 1, results: [fail('title', 'blank')] },
      { name: 'pacing', exitCode: 124, results: null },
    ], 60)
    expect(combined.exitCode).toBe(124)
    const text = alert.whatHappened({ exitCode: combined.exitCode, capMinutes: 60, results: combined.results })
    expect(text).toContain('**title**: blank')
    expect(text).toContain('**part pacing**: stopped at the 60 min cap before it reported any result')
  })

  it('is red when a part left nothing or crashed without a failed check', () => {
    const missing = parts.combine([{ name: 'deep', exitCode: null, results: null }], 60)
    expect(missing.exitCode).toBe(1)
    expect(missing.results[0].problems[0]).toMatch(/left no result/)
    const crashed = parts.combine([{ name: 'main', exitCode: 1, results: [pass('title')] }], 60)
    expect(crashed.exitCode).toBe(1)
    expect(crashed.results.at(-1)).toMatchObject({ id: 'part main', ok: false })
  })

  it('is inconclusive, not red, when a part failed only because production redeployed under it (#822)', () => {
    const redeployed = [
      pass('title'),
      { ...fail('level6', 'Failed to fetch dynamically imported module'), inconclusive: true },
      { ...fail('build', 'production redeployed mid-run (index-AAA.js → index-BBB.js): no single build tested'), inconclusive: true },
    ]
    const combined = parts.combine([
      { name: 'main', exitCode: alert.INCONCLUSIVE, results: redeployed },
      { name: 'deep', exitCode: 0, results: [pass('boss')] },
    ], 60)
    expect(combined.exitCode).toBe(alert.INCONCLUSIVE)
    const text = alert.whatHappened({ exitCode: combined.exitCode, capMinutes: 60, results: combined.results })
    expect(text).toMatch(/^Inconclusive, not red: production redeployed mid-run/)
    expect(text).toContain('**level6**: Failed to fetch dynamically imported module')
    expect(text).toContain('**build**: production redeployed mid-run (index-AAA.js → index-BBB.js)')
  })

  it('stays red when another part failed on an unchanged build, without counting the inconclusive part\'s checks', () => {
    const combined = parts.combine([
      { name: 'main', exitCode: alert.INCONCLUSIVE, results: [{ ...fail('level6', 'stale chunk'), inconclusive: true }] },
      { name: 'deep', exitCode: 1, results: [fail('boss', 'no kill')] },
    ], 60)
    expect(combined.exitCode).toBe(1)
    expect(alert.whatHappened({ exitCode: 1, capMinutes: 60, results: combined.results })).toBe('Check failed:\n- **boss**: no kill')
  })

  it('reads each part\'s artifact folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nightly-parts-'))
    fs.mkdirSync(path.join(dir, 'prod-e2e-results-main'))
    fs.writeFileSync(path.join(dir, 'prod-e2e-results-main', 'exit-code'), '124\n')
    fs.writeFileSync(path.join(dir, 'prod-e2e-results-main', 'results.json'), JSON.stringify([pass('title')]))
    expect(parts.readPart(dir, 'main')).toEqual({ name: 'main', exitCode: 124, results: [pass('title')] })
    expect(parts.readPart(dir, 'deep')).toEqual({ name: 'deep', exitCode: null, results: null })
    fs.rmSync(dir, { recursive: true })
  })
})
