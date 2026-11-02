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

  it('diagnoses cache misses by cause, compactions, peak context and heavy tool results', () => {
    const at = (min: number) => `2026-10-24T10:${String(min).padStart(2, '0')}:00Z`
    const turn = (id: string, min: number, write: number, read: number, tool?: object) =>
      line({
        type: 'assistant', requestId: `r${id}`, timestamp: at(min),
        message: { id, model: 'claude-opus-x', usage: { input_tokens: 5, cache_creation_input_tokens: write, cache_read_input_tokens: read, output_tokens: 10 }, content: tool ? [tool] : [] },
      })
    const bash = (id: string, command: string) => ({ type: 'tool_use', id, name: 'Bash', input: { command } })
    const result = (id: string, content: unknown) =>
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } })
    const main = [
      turn('a', 0, 30_000, 0, bash('t1', 'npm ci')), // start: expected
      result('t1', 'x'.repeat(5000)),
      turn('b', 1, 2_000, 30_000, bash('t2', 'npm run verify')), // normal append
      result('t2', [{ type: 'text', text: 'y'.repeat(9000) }, { type: 'image' }]),
      turn('c', 20, 40_000, 1_000), // 19 min after the last turn: cache expired
      line({ type: 'system', subtype: 'compact_boundary' }),
      line({ type: 'user', isCompactSummary: true }),
      turn('d', 21, 25_000, 3_000), // first turn after compaction
      turn('d', 21, 25_000, 3_000), // same message streamed again: counted once
    ].join('\n')
    const sub = turn('s', 22, 21_000, 100) // a subagent's first turn: start
    const d = usage.diagnose([{ text: main, subagent: false }, { text: sub, subagent: true }])

    expect(d.compactions).toBe(1)
    expect(d.misses).toBe(2)
    expect(d.causes).toEqual({ idle: 1, compaction: 1 })
    expect(d.missTokens).toBe(65_000)
    expect(d.topMisses[0]).toMatchObject({ cause: 'idle', tokens: 40_000, gapMin: 19, after: 'Bash: npm run verify' })
    expect(d.peakContext).toBe(41_005)
    expect(d.images).toBe(1)
    expect(d.resultChars).toBe(14_000)
    expect(d.heaviest[0]).toMatchObject({ tool: 'Bash: npm run verify', chars: 9000, images: 1 })
  })

  it('adds the diagnosis to the ledger line when present', () => {
    const entry = { v: 1, role: 'builders', ref: '#1', weighted: 2_000_000, turns: 10, subagents: 2, minutes: 30,
      diag: { peakContext: 180_000, compactions: 2, misses: 7, missTokens: 900_000 } }
    expect(usage.ledgerComment(entry).split('\n')[0]).toContain('peak ctx 180k · 2 compactions · 7 cache misses (~900k)')
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
    expect(l.refs).toEqual([{ ref: '#12', weighted: 2_300_000 }, { ref: '#14', weighted: 300_100 }])
  })

  it('keeps every ref, excludes runs at or after `until`, and renders only the top 5', () => {
    const comments = [1, 2, 3, 4, 5, 6].map((n) => comment(entry('builders', `#${n}`, n * 1000, `s${n}`), n))
    comments.push(comment(entry('qa', '#7', 9000, 's7', '2026-10-24T12:00:00Z'), 7))
    const l = status.ledgerSummary(comments, since, now)

    expect(l.runs).toBe(6)
    expect(l.refs.map((r: { ref: string }) => r.ref)).toEqual(['#6', '#5', '#4', '#3', '#2', '#1'])
    const md = status.render(
      { issues: [], prs: [], drafts: [], merged: [], building: [], ci: [], mainVerify: null, prodSmoke: null, steeringPaused: false, ledger: { number: 1, ...l } },
      now,
    )
    expect(md).toContain('Most expensive: #6 ~6k · #5 ~5k · #4 ~4k · #3 ~3k · #2 ~2k\n')
  })

  it('puts the ref in backticks in the human line', () => {
    expect(usage.ledgerComment(entry('qa', '#12', 1000, 'a')).split('\n')[0]).toContain('· `#12` ·')
  })
})
