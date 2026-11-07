import { describe, expect, it } from 'vitest'
import telemetry from './playerTelemetry.cjs'
import rules from './studioHealthRules.cjs'
import status from './studio-status.cjs'

const { fetchTelemetry, phoneFrameBudget, telemetrySection, telemetryFindings } = telemetry

const UNTIL = '2026-11-07T12:00:00.000Z'
const error = (over: object = {}) => ({
  key: '0a1b2c3d',
  message: "Cannot read properties of undefined (reading 'position')",
  frame: 'tick (/assets/index-abc.js:1:2345)',
  sessions: 4,
  count: 9,
  firstSeen: '2026-11-07T01:00:00.000Z',
  lastSeen: '2026-11-07T11:30:00.000Z',
  versions: ['0.1.0+abc1234'],
  ...over,
})
const frames = (over: object = {}) => ({ level: 'level4', device: 'touch', sessions: 5, frames: 9000, p50Ms: 18, p95Ms: 41.5, worstP95Ms: 80, ...over })
const summary = (over: object = {}) => ({
  since: '2026-11-06T12:00:00.000Z',
  until: UNTIL,
  sessions: 42,
  truncated: false,
  errors: [error()],
  contextLost: { sessions: 2, gpus: [{ gpu: 'Mali-G52', sessions: 2 }] },
  frames: [frames(), frames({ level: 'level1', p95Ms: 17 }), frames({ device: 'desktop', p95Ms: 50 })],
  ...over,
})

describe('fetchTelemetry', () => {
  it('returns the summary, or null when the endpoint is down, unreachable or answers nonsense', async () => {
    const s = summary()
    expect(await fetchTelemetry(async () => Response.json(s), 'https://x/api/telemetry')).toEqual(s)
    expect(await fetchTelemetry(async () => Response.json({ error: 'unavailable' }, { status: 503 }), 'u')).toBeNull()
    expect(await fetchTelemetry(async () => Response.json({ sessions: 'x' }), 'u')).toBeNull()
    expect(await fetchTelemetry(async () => { throw new Error('offline') }, 'u')).toBeNull()
  })

  it('reads the phone budget from budgets.json', () => {
    expect(phoneFrameBudget()).toBeGreaterThan(16)
    expect(phoneFrameBudget('/nope/budgets.json')).toBeNull()
  })
})

describe('telemetrySection', () => {
  it('shows sessions, errors, context losses and frame times, flagging phones over budget', () => {
    const md = telemetrySection(summary(), 33.4).join('\n')
    expect(md).toContain('42 play sessions reported · 1 distinct errors · 2 WebGL context losses (Mali-G52 ×2)')
    expect(md).toContain("| 4 | 9 | Cannot read properties of undefined (reading 'position') | `tick (/assets/index-abc.js:1:2345)` |")
    expect(md).toContain('| level4 | touch | 5 | 18 | 41.5 ⚠️ | 80 |')
    expect(md).toContain('| level1 | touch | 5 | 18 | 17 | 80 |')
    expect(md).toContain('| level4 | desktop | 5 | 18 | 50 | 80 |')
  })

  it('says when telemetry is unavailable', () => {
    expect(telemetrySection(null, 33.4).join('\n')).toContain('Telemetry unavailable')
  })

  it('is on the status page when collected, and absent when not', () => {
    const now = Date.parse(UNTIL)
    const empty = { issues: [], prs: [], drafts: [], merged: [], building: [], ci: {}, mainVerify: null, prodSmoke: null, steeringPaused: false, ledger: null, milestones: [] }
    expect(status.render(empty, now)).not.toContain('Players')
    expect(status.render({ ...empty, telemetry: summary(), phoneBudget: 33.4 }, now)).toContain('### 📡 Players (last 24 h)')
  })
})

describe('telemetryFindings', () => {
  it('files an error seen in 3+ sessions, keyed by the error', () => {
    const found = telemetryFindings(summary({ frames: [] }), { budget: 33.4 })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ key: 'player-error:0a1b2c3d', owner: 'agents', lastSeen: Date.parse('2026-11-07T11:30:00.000Z') })
    expect(found[0].title).toBe("Player error in 4 sessions: Cannot read properties of undefined (reading 'position')")
    expect(found[0].body).toContain('tick (/assets/index-abc.js:1:2345)')
    expect(telemetryFindings(summary({ errors: [error({ sessions: 2 })], frames: [] }))).toEqual([])
  })

  it('files a closed error again only when a session after the close hits it', () => {
    const closedAt = { 'player-error:0a1b2c3d': Date.parse('2026-11-07T11:45:00.000Z') }
    expect(telemetryFindings(summary({ frames: [] }), { closedAt })).toEqual([])
    expect(telemetryFindings(summary({ frames: [], errors: [error({ lastSeen: '2026-11-07T11:50:00.000Z' })] }), { closedAt })).toHaveLength(1)
  })

  it('files a level over the phone budget while it is, from enough sessions, and never desktops', () => {
    const found = telemetryFindings(summary({ errors: [] }), { budget: 33.4 })
    expect(found.map((f: { key: string }) => f.key)).toEqual(['player-perf:level4'])
    expect(found[0]).toMatchObject({ state: true, lastSeen: Date.parse(UNTIL) })
    expect(found[0].title).toBe('level4 runs slow on phones: p95 frame 41.5 ms (budget 33.4)')
    expect(telemetryFindings(summary({ errors: [], frames: [frames({ sessions: 2 })] }), { budget: 33.4 })).toEqual([])
    expect(telemetryFindings(summary({ errors: [] }), { budget: null })).toEqual([])
  })

  it('finds nothing without a summary, and the watchdog includes its findings', () => {
    expect(telemetryFindings(null, { budget: 33.4 })).toEqual([])
    const snap = {
      now: Date.parse(UNTIL), runs: [], prFiles: {}, timeouts: {}, openPrs: [], openIssues: [], closedAt: {}, lastAgentActivity: Date.parse(UNTIL), paused: false,
      telemetry: summary(), phoneFrameBudget: 33.4,
    }
    expect(rules.findings(snap).map((f: { key: string }) => f.key)).toEqual(['player-error:0a1b2c3d', 'player-perf:level4'])
  })
})
