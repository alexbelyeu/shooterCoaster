import { describe, expect, it } from 'vitest'
import { normalizeInitials } from '@/store/leaderboard'
import { checkSubmission, clientIp, hashIp, rankFrom, rateLimited, RATE_LIMIT, windowStart } from './rules'
import { LEVEL_LIMITS } from './levelLimits'

const good = { level: 'level1', initials: 'ABC', score: 2400, seed: 123456, kills: 120, accuracy: 0.8, version: '2.0.0+abc1234' }

describe('checkSubmission', () => {
  it('accepts a real run', () => {
    expect(checkSubmission(good)).toEqual({ ok: true, value: good })
  })

  it.each([
    ['an unknown level', { level: 'level99' }],
    ['a prototype key as level', { level: 'toString' }],
    ['lower-case initials', { initials: 'abc' }],
    ['two letters', { initials: 'AB' }],
    ['a digit', { initials: 'A1C' }],
    ['a zero score', { score: 0 }],
    ['a fractional score', { score: 10.5 }],
    ['a score string', { score: '2400' }],
    ['a score over the level max', { score: LEVEL_LIMITS.level1.maxScore + 1 }],
    ['more kills than the level has', { kills: LEVEL_LIMITS.level1.maxKills + 1 }],
    ['negative kills', { kills: -1 }],
    ['too many points for the kills', { kills: 1, score: LEVEL_LIMITS.level1.maxKillPoints + 1 }],
    ['accuracy over 1', { accuracy: 1.2 }],
    ['NaN accuracy', { accuracy: Number.NaN }],
    ['a negative seed', { seed: -1 }],
    ['a seed past 32 bits', { seed: 2 ** 32 }],
    ['an odd version', { version: '<script>' }],
  ])('rejects %s', (_label, patch) => {
    expect(checkSubmission({ ...good, ...patch }).ok).toBe(false)
  })

  it('rejects a body that is not an object', () => {
    for (const body of [null, [], 'x', 3]) expect(checkSubmission(body).ok).toBe(false)
  })

  it('takes exactly the initials the game stores', () => {
    for (const raw of ['abc', 'Zq', '', 'x1y2z3']) expect(checkSubmission({ ...good, initials: normalizeInitials(raw) }).ok).toBe(true)
  })

  it('accepts the level max itself', () => {
    const { maxScore, maxKills } = LEVEL_LIMITS.level1
    expect(checkSubmission({ ...good, score: maxScore, kills: maxKills }).ok).toBe(true)
  })
})

describe('rate limit', () => {
  it('allows five in the window and refuses the sixth', () => {
    expect(RATE_LIMIT.max).toBe(5)
    expect(rateLimited(4)).toBe(false)
    expect(rateLimited(5)).toBe(true)
  })

  it('looks back ten minutes', () => {
    expect(windowStart(Date.UTC(2026, 10, 5, 12, 10))).toBe('2026-11-05T12:00:00.000Z')
  })
})

describe('IP hashing', () => {
  it('reads the client address Vercel forwards', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8')
    expect(clientIp(new Headers())).toBe('unknown')
  })

  it('is a salted, stable hex digest that never contains the IP', async () => {
    const a = await hashIp('1.2.3.4', 'salt')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashIp('1.2.3.4', 'salt')).toBe(a)
    expect(await hashIp('1.2.3.4', 'other')).not.toBe(a)
    expect(await hashIp('1.2.3.5', 'salt')).not.toBe(a)
  })
})

describe('rankFrom', () => {
  it('is 1-based on the top 10 and null below it', () => {
    expect(rankFrom(1)).toBe(1)
    expect(rankFrom(10)).toBe(10)
    expect(rankFrom(11)).toBeNull()
    expect(rankFrom(0)).toBeNull()
  })
})
