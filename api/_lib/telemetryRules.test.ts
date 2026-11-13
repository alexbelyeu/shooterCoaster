import { describe, expect, it } from 'vitest'
import { checkReport, dailySalt, errorKey, summarize, type ReportRow } from './telemetryRules'

const good = {
  version: '0.1.0+abc1234',
  touch: true,
  cores: 8,
  gpu: 'Adreno (TM) 640',
  contextLost: 0,
  errors: [{ message: 'boom', frame: 'f (/assets/index.js:1:2)', count: 2 }],
  levels: [{ level: 'level1', quality: 'auto', dpr: 1.5, frames: 3000, p50Ms: 16.75, p95Ms: 24.25, maxMs: 180, longFrames: 2 }],
}

describe('checkReport', () => {
  it('accepts a well-formed report', () => {
    expect(checkReport(good)).toEqual({ ok: true, value: good })
    expect(checkReport({ ...good, cores: null, gpu: null, errors: [] }).ok).toBe(true)
    // A client built before #536 sends no longest frame or long-frame count.
    const { maxMs: _max, longFrames: _long, ...older } = good.levels[0]
    expect(checkReport({ ...good, levels: [older] })).toMatchObject({ ok: true, value: { levels: [{ ...older, maxMs: null, longFrames: null }] } })
  })

  it('drops anything malformed, whole', () => {
    const bad: unknown[] = [
      null,
      [],
      'x',
      { ...good, version: 'a b' },
      { ...good, touch: 1 },
      { ...good, cores: 0 },
      { ...good, gpu: 'x'.repeat(121) },
      { ...good, gpu: 'a\nb' },
      { ...good, contextLost: -1 },
      { ...good, errors: Array(6).fill(good.errors[0]) },
      { ...good, errors: [{ ...good.errors[0], message: '' }] },
      { ...good, errors: [{ ...good.errors[0], count: 0 }] },
      { ...good, levels: [{ ...good.levels[0], level: 'level99' }] },
      { ...good, levels: [{ ...good.levels[0], quality: 'ultra' }] },
      { ...good, levels: [{ ...good.levels[0], p95Ms: 10 }] },
      { ...good, levels: [{ ...good.levels[0], maxMs: 12 }] },
      { ...good, levels: [{ ...good.levels[0], maxMs: 1001 }] },
      { ...good, levels: [{ ...good.levels[0], longFrames: 3001 }] },
      { ...good, levels: [{ ...good.levels[0], longFrames: 1.5 }] },
      { ...good, levels: [{ ...good.levels[0], dpr: 0 }] },
      { ...good, levels: Array(9).fill(good.levels[0]) },
      { ...good, errors: [], levels: [] },
    ]
    for (const body of bad) expect(checkReport(body).ok, JSON.stringify(body)?.slice(0, 80)).toBe(false)
  })

  it('salts the IP hash per UTC day', () => {
    expect(dailySalt('s', Date.parse('2026-11-07T23:59:00Z'))).toBe('s:telemetry:2026-11-07')
    expect(dailySalt('s', Date.parse('2026-11-08T00:00:00Z'))).toBe('s:telemetry:2026-11-08')
  })
})

const row = (over: Partial<ReportRow>): ReportRow => ({
  created_at: '2026-11-07T10:00:00.000Z',
  client_version: '0.1.0+abc1234',
  touch: true,
  gpu: null,
  context_lost: 0,
  errors: [],
  levels: [],
  ...over,
})

describe('summarize', () => {
  const now = Date.parse('2026-11-07T12:00:00Z')

  it('counts each error once per session, with its total, versions and when it was seen', () => {
    const e = { message: 'boom', frame: 'f (/a.js:1:2)', count: 3 }
    const s = summarize(
      [
        row({ errors: [e, { ...e, count: 1 }], created_at: '2026-11-07T09:00:00.000Z' }),
        row({ errors: [e], client_version: '0.1.0+def5678', created_at: '2026-11-07T11:00:00.000Z' }),
        row({ errors: [{ message: 'other', frame: '', count: 1 }] }),
      ],
      now,
    )
    expect(s.sessions).toBe(3)
    expect(s.since).toBe('2026-11-06T12:00:00.000Z')
    expect(s.errors[0]).toEqual({
      key: errorKey('boom', 'f (/a.js:1:2)'),
      message: 'boom',
      frame: 'f (/a.js:1:2)',
      sessions: 2,
      count: 7,
      firstSeen: '2026-11-07T09:00:00.000Z',
      lastSeen: '2026-11-07T11:00:00.000Z',
      versions: ['0.1.0+abc1234', '0.1.0+def5678'],
    })
    expect(s.errors[1].message).toBe('other')
  })

  it('keys errors stably by message and frame', () => {
    expect(errorKey('boom', 'f')).toMatch(/^[0-9a-f]{8}$/)
    expect(errorKey('boom', 'f')).toBe(errorKey('boom', 'f'))
    expect(errorKey('boom', 'f')).not.toBe(errorKey('boom', 'g'))
  })

  it('counts context losses and the GPUs they happened on', () => {
    const s = summarize([row({ context_lost: 2, gpu: 'Mali-G52' }), row({ context_lost: 1, gpu: 'Mali-G52' }), row({ context_lost: 1 }), row({})], now)
    expect(s.contextLost).toEqual({ sessions: 3, gpus: [{ gpu: 'Mali-G52', sessions: 2 }, { gpu: 'unknown', sessions: 1 }] })
  })

  it('gives each level x device class the median session p50 / p95, the worst p95 and longest frame, and the long frames', () => {
    const lvl = (p95Ms: number, level = 'level1', maxMs: number | null = null, longFrames: number | null = null) =>
      ({ level, quality: 'auto', dpr: 1.5, frames: 100, p50Ms: 16, p95Ms, maxMs, longFrames })
    const s = summarize(
      [
        row({ levels: [lvl(20, 'level1', 310, 2)] }),
        row({ levels: [lvl(30, 'level1', 140, 1), lvl(18, 'level2')] }),
        row({ levels: [lvl(90)] }),
        row({ touch: false, levels: [lvl(17)] }),
      ],
      now,
    )
    expect(s.frames).toEqual([
      { level: 'level1', device: 'desktop', sessions: 1, frames: 100, p50Ms: 16, p95Ms: 17, worstP95Ms: 17, worstMaxMs: null, longFrames: 0 },
      { level: 'level1', device: 'touch', sessions: 3, frames: 300, p50Ms: 16, p95Ms: 30, worstP95Ms: 90, worstMaxMs: 310, longFrames: 3 },
      { level: 'level2', device: 'touch', sessions: 1, frames: 100, p50Ms: 16, p95Ms: 18, worstP95Ms: 18, worstMaxMs: null, longFrames: 0 },
    ])
  })

  it('is empty for no rows', () => {
    const s = summarize([], now, false)
    expect(s).toMatchObject({ sessions: 0, truncated: false, errors: [], frames: [], contextLost: { sessions: 0, gpus: [] } })
  })
})
