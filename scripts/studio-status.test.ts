import { describe, expect, it } from 'vitest'
import status from './studio-status.cjs'

const now = Date.parse('2026-11-05T12:00:00Z')
const milestone = (o: object) => ({
  title: 'M2 — The arcade loop',
  html_url: 'https://github.com/o/r/milestone/1',
  due_on: '2026-11-08T00:00:00Z',
  open_issues: 6,
  closed_issues: 33,
  p1: [],
  ...o,
})
const empty = { issues: [], prs: [], drafts: [], merged: [], building: [], ci: {}, mainVerify: null, prodSmoke: null, steeringPaused: false, ledger: null }

describe('studio-status milestoneSection', () => {
  it('renders nothing when no milestone is open', () => {
    expect(status.milestoneSection([], now)).toBe('')
    expect(status.render({ ...empty, milestones: [] }, now)).not.toContain('Milestones')
  })

  it('shows partial progress, the due date, days left and the open P1s', () => {
    const md = status.milestoneSection([milestone({ p1: [{ number: 176, title: 'Combo tiers' }, { number: 177, title: 'Bosses' }] })], now)
    expect(md).toBe(
      '### 🎯 Milestones\n' +
        '**[M2 — The arcade loop](https://github.com/o/r/milestone/1)** · due Sun, Nov 8 (3 days left)\n' +
        '`████████░░` 33 / 39 closed (84 %) · Open P1: #176 Combo tiers · #177 Bosses\n',
    )
  })

  it('handles 0 %, 100 %, an empty milestone, no due date and overdue', () => {
    const md = status.milestoneSection([
      milestone({ open_issues: 5, closed_issues: 0 }),
      milestone({ open_issues: 0, closed_issues: 12, due_on: '2026-11-05T00:00:00Z' }),
      milestone({ open_issues: 0, closed_issues: 0, due_on: null }),
      milestone({ due_on: '2026-11-03T00:00:00Z' }),
    ], now)
    expect(md).toContain('`░░░░░░░░░░` 0 / 5 closed (0 %) · No open P1.')
    expect(md).toContain('`██████████` 12 / 12 closed (100 %)')
    expect(md).toContain('· no due date\n`░░░░░░░░░░` 0 / 0 closed (0 %)')
    expect(md).toContain('due Tue, Nov 3 (⚠️ 2 days overdue)')
    expect(md).toContain('due Thu, Nov 5 (due today)')
  })

  it('sits right after the header, before the build table', () => {
    const md = status.render({ ...empty, milestones: [milestone({})] }, now)
    expect(md.indexOf('### 🎯 Milestones')).toBeLessThan(md.indexOf('### 🔨 Being built now'))
    expect(md.indexOf('### 🎯 Milestones')).toBeGreaterThan(md.indexOf('<sub>Updated'))
  })

  it('sorts soonest due first, no due date last, ties by number (#378)', () => {
    const md = status.milestoneSection([
      milestone({ number: 4, title: 'None', due_on: null }),
      milestone({ number: 3, title: 'Later', due_on: '2026-12-01T00:00:00Z' }),
      milestone({ number: 2, title: 'Soon B' }),
      milestone({ number: 1, title: 'Soon A' }),
    ], now)
    const order = ['Soon A', 'Soon B', 'Later', 'None'].map((t) => md.indexOf(`**[${t}]`))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('keeps the bars when the P1 lookup fails (#378)', async () => {
    const api = async (route: string) => {
      if (route.includes('/milestones')) return [milestone({ number: 1 })]
      throw new Error('502')
    }
    const md = status.milestoneSection(await status.collectMilestones(api), now)
    expect(md).toContain('`████████░░` 33 / 39 closed (84 %) · Open P1s unavailable.')
  })

  it('escapes milestone and issue titles (#378)', () => {
    const md = status.milestoneSection([milestone({ title: 'M3 [beta] | fair', p1: [{ number: 9, title: 'Fix [x](y) | z' }] })], now)
    expect(md).toContain('**[M3 \\[beta\\] \\| fair](https://github.com/o/r/milestone/1)**')
    expect(md).toContain('#9 Fix \\[x\\](y) \\| z')
  })
})

describe('studio-status production suites (#359)', () => {
  const run = (o: object) => ({ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-11-05T10:00:00Z', updated_at: '2026-11-05T10:20:00Z', html_url: 'https://x/run', ...o })
  const deployGreen = run({ id: 1, event: 'deployment_status', created_at: '2026-11-05T11:00:00Z' })
  const nightlyRed = run({ id: 2, event: 'schedule', conclusion: 'failure', created_at: '2026-11-05T06:00:00Z' })
  const jobs = (ran: string) => ['deploy', 'nightly-part (main)', 'nightly'].map((name) => ({ name, conclusion: name.startsWith(ran) ? 'success' : 'skipped' }))

  it('picks the newest run of each suite, ignoring skipped, cancelled and unfinished runs', () => {
    const skipped = run({ id: 3, event: 'deployment_status', conclusion: 'skipped', created_at: '2026-11-05T11:30:00Z' })
    const cancelled = run({ id: 4, event: 'schedule', conclusion: 'cancelled', created_at: '2026-11-05T11:40:00Z' })
    const running = run({ id: 5, event: 'deployment_status', status: 'in_progress', conclusion: null, created_at: '2026-11-05T11:50:00Z' })
    expect(status.pickProdRuns([skipped, cancelled, running, nightlyRed, deployGreen])).toEqual({ deploy: deployGreen, nightly: nightlyRed })
    expect(status.pickProdRuns([deployGreen])).toEqual({ deploy: deployGreen, nightly: null })
  })

  it('tells a dispatch\'s suite by the jobs that ran', () => {
    const dispatch = run({ id: 6, event: 'workflow_dispatch', created_at: '2026-11-05T12:00:00Z' })
    expect(status.prodSuite(dispatch, jobs('deploy'))).toBe('deploy')
    expect(status.prodSuite(dispatch, jobs('nightly'))).toBe('nightly')
    expect(status.prodSuite(dispatch, [])).toBeNull()
    expect(status.pickProdRuns([dispatch, nightlyRed, deployGreen], () => jobs('nightly'))).toEqual({ deploy: deployGreen, nightly: dispatch })
  })

  it('renders a red nightly and a green deploy check on their own lines, the prod-broken issue by suite', () => {
    const issue = { number: 42, title: 'Nightly smoke red', labels: [{ name: 'agent:prod-broken' }], body: 'x\n<!-- prod-smoke:nightly -->' }
    const md = status.render({ ...empty, issues: [issue], milestones: [], prodSmoke: { deploy: deployGreen, nightly: nightlyRed } }, now)
    expect(md).toContain('- Deploy check: ✅ passed')
    expect(md).toContain('- Nightly full smoke: ❌ failure')
    expect(md).toContain('- Open prod-broken issues: #42 nightly')
    expect(md).toContain('🚨 production smoke failing (#42 nightly)')
  })

  it('asks for each event\'s runs and reads only the dispatches\' jobs', async () => {
    const dispatch = run({ id: 7, event: 'workflow_dispatch', created_at: '2026-11-05T12:00:00Z' })
    const byEvent: Record<string, object[]> = { deployment_status: [deployGreen], schedule: [nightlyRed], workflow_dispatch: [dispatch] }
    const jobCalls: unknown[] = []
    const api = async (route: string, params: Record<string, unknown>) => {
      if (!route.endsWith('/jobs')) return { workflow_runs: byEvent[params.event as string] }
      jobCalls.push(params.run_id)
      return { jobs: jobs('deploy') }
    }
    expect(await status.collectProdSmoke(api)).toEqual({ deploy: dispatch, nightly: nightlyRed })
    expect(jobCalls).toEqual([7])
  })
})
