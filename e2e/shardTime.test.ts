import { describe, expect, it } from 'vitest'
import { MAX_RUNNER_SLOWNESS, NORMAL_RUNNER_MS_PER_FRAME, WATCHDOG_FACTOR, judgeShardTime, rideMsPerFrame, runnerSlowness } from './shardTime.mjs'

const judge = (seconds: number, msPerFrame: number | null, enforced = true) =>
  judgeShardTime({ shard: 'level5', seconds, budget: 180, msPerFrame, enforced })

describe('rideMsPerFrame', () => {
  it('takes the slowest ride and ignores results without one', () => {
    expect(rideMsPerFrame([{ id: 'title' }, { id: 'level5', rideMsPerFrame: 420 }, { id: 'level5-shot' }])).toBe(420)
    expect(rideMsPerFrame([{ rideMsPerFrame: 300 }, { rideMsPerFrame: 450 }])).toBe(450)
    expect(rideMsPerFrame([{ id: 'title' }, { rideMsPerFrame: null }, { rideMsPerFrame: Infinity }])).toBeNull()
  })
})

describe('runnerSlowness', () => {
  it('is 1 on a normal or fast runner, or with no ride', () => {
    expect(runnerSlowness(null)).toBe(1)
    expect(runnerSlowness(NORMAL_RUNNER_MS_PER_FRAME)).toBe(1)
    expect(runnerSlowness(200)).toBe(1)
  })
  it('scales with the ride frame time, capped', () => {
    expect(runnerSlowness(450)).toBeCloseTo(1.5)
    expect(runnerSlowness(5000)).toBe(MAX_RUNNER_SLOWNESS)
  })
})

describe('judgeShardTime', () => {
  it('passes a shard within its budget', () => {
    expect(judge(100, 280)).toMatchObject({ ok: true, level: 'notice', text: 'level5 shard took 1.7 min, budget 3.0' })
  })

  it('passes a slow runner over budget but within its allowance, with a warning (#394)', () => {
    const r = judge(252, 525)
    expect(r).toMatchObject({ ok: true, level: 'warning' })
    expect(r.allowed).toBeCloseTo(315)
    expect(r.text).toBe('level5 shard took 4.2 min, budget 3.0: over, within what a slow runner (ride 525 ms/frame, 1.8x normal) allows 5.3')
  })

  it('fails a real slowdown on a normal-speed runner', () => {
    expect(judge(200, 290)).toMatchObject({ ok: false, level: 'error', text: 'level5 shard took 3.3 min, budget 3.0' })
  })

  it('fails a slow runner past its allowance, and a shard with no ride over its plain budget', () => {
    const slow = judge(400, 450)
    expect(slow).toMatchObject({ ok: false, level: 'error' })
    expect(slow.text).toBe('level5 shard took 6.7 min, budget 3.0, and a slow runner (ride 450 ms/frame, 1.5x normal) allows 4.5')
    expect(judge(181, null)).toMatchObject({ ok: false, allowed: 180 })
  })

  it('only warns off CI', () => {
    expect(judge(400, 290, false)).toMatchObject({ ok: true, level: 'warning', text: 'level5 shard took 6.7 min, budget 3.0 (over; enforced on CI only)' })
  })

  it('stops a run only after the most a slow runner is allowed', () => {
    expect(WATCHDOG_FACTOR).toBeGreaterThan(MAX_RUNNER_SLOWNESS)
  })
})
