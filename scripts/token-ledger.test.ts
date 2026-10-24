import { describe, expect, it } from 'vitest'
import usage from './run-usage.cjs'
import status from './studio-status.cjs'

const line = (o: object) => JSON.stringify(o)
const assistant = (id: string, req: string, usage: object, model = 'claude-opus-x', timestamp = '2026-10-24T10:00:00Z') =>
  line({ type: 'assistant', requestId: req, timestamp, message: { id, model, usage } })

describe('run-usage summarize', () => {
  it('counts a streamed message once and sums main + subagent transcripts per model', () => {
    const u = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 5 }
    const main = [
      line({ type: 'user', timestamp: '2026-10-24T09:58:00Z' }),
      assistant('m1', 'r1', u), // one line per content block, same usage
      assistant('m1', 'r1', u),
      assistant('m2', 'r2', { ...u, output_tokens: 20 }, 'claude-opus-x', '2026-10-24T10:10:00Z'),
      assistant('m3', 'r3', u, '<synthetic>'),
      'not json',
    ].join('\n')
    const sub = assistant('s1', 'r9', u, 'claude-sonnet-x', '2026-10-24T10:05:00Z')
    const s = usage.summarize([{ text: main, subagent: false }, { text: sub, subagent: true }])

    expect(s.turns).toBe(3)
    expect(s.output).toBe(30)
    expect(s.cacheRead).toBe(3000)
    expect(s.models['claude-opus-x'].turns).toBe(2)
    expect(s.models['claude-sonnet-x'].turns).toBe(1)
    expect(s.subagents).toBe(1)
    expect(s.minutes).toBe(12)
    // input + output + 1.25 × cache writes + 0.1 × cache reads
    expect(s.weighted).toBe(30 + 30 + 375 + 300)
  })

  it('normalizes refs', () => {
    expect(usage.normalizeRef('PR #12, #14')).toBe('#12,#14')
    expect(usage.normalizeRef('123')).toBe('#123')
    expect(usage.normalizeRef('none')).toBe('none')
    expect(usage.normalizeRef('weekly report')).toBe('weekly report')
  })
})

describe('ledger comments → studio status', () => {
  const now = Date.parse('2026-10-24T12:00:00Z')
  const since = now - 7 * 24 * 3600e3
  const comment = (o: object, id: number) => ({ id, created_at: '2026-10-24T11:00:00Z', body: usage.ledgerComment(o) })
  const entry = (role: string, ref: string, weighted: number, session: string, at = '2026-10-24T11:00:00Z') =>
    ({ v: 1, role, ref, at, session, weighted, turns: 1, subagents: 0, minutes: 1 })

  it('round-trips the marker, keeps a session once, splits shared refs and skips old runs', () => {
    const comments = [
      comment(entry('qa', '#12', 1_000_000, 'a'), 1),
      comment(entry('qa', '#12', 2_000_000, 'a'), 2), // same session posted again: latest wins
      comment(entry('builders', '#12,#14', 600_000, 'b'), 3),
      comment({ ...entry('fix', '#14', 100, 'c'), note: 'tricky --> note' }, 4),
      comment(entry('reporter', 'none', 50_000, 'd', '2026-10-01T00:00:00Z'), 5),
      { id: 6, created_at: '2026-10-24T11:00:00Z', body: 'a human comment' },
    ]
    const l = status.ledgerSummary(comments, since)

    expect(l.runs).toBe(3)
    expect(l.total).toBe(2_600_100)
    expect(l.roles.map((r: { role: string }) => r.role)).toEqual(['qa', 'builders', 'fix'])
    expect(l.top).toEqual([{ ref: '#12', weighted: 2_300_000 }, { ref: '#14', weighted: 300_100 }])
  })
})
