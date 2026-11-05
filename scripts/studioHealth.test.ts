import { describe, expect, it } from 'vitest'
import rules from './studioHealthRules.cjs'
import watchdog from './studio-health.cjs'

const { findings, staleProdAlerts, parseTimeouts, isDocsOnly } = rules
const { reconcile, escalateProdAlerts } = watchdog

const H = 3600e3
const NOW = Date.parse('2026-11-04T16:00:00Z')
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

const job = (name: string, conclusion: string, mins: number, steps: object[] = [], extra = {}) => ({
  id: 1, name, conclusion, started_at: iso(mins * 60e3 + H), completed_at: iso(H), html_url: 'https://j', steps, ...extra,
})
const run = (over: object) => ({
  id: 1, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', conclusion: 'failure',
  head_branch: 'agent/x', head_sha: 'aaaaaaa1', created_at: iso(2 * H), html_url: 'https://r', prNumber: 10, jobs: [], ...over,
})
const onMain = (over: object) => run({ event: 'push', head_branch: 'main', prNumber: null, ...over })
const smokeFail = (over: object = {}) => run({ jobs: [job('verify', 'failure', 25, [{ name: 'Smoke', conclusion: 'failure' }])], ...over })
const snap = (over: object) => ({
  now: NOW, runs: [], prFiles: {}, timeouts: {}, openPrs: [], openIssues: [], closedAt: {}, lastAgentActivity: NOW - H, paused: false, ...over,
})
const keys = (s: object) => findings(s).map((f: { key: string }) => f.key)
const docsPr = { 10: ['docs/a.md'] }

describe('parseTimeouts', () => {
  it('reads job and step limits, keyed by job name', () => {
    const yaml = [
      'name: CI', 'on: push', 'jobs:',
      '  verify:', '    name: verify', '    runs-on: ubuntu-24.04', '    timeout-minutes: 40 # headroom',
      '    steps:', '      - uses: actions/checkout@v4', '      - name: Smoke test', '        timeout-minutes: 32', '        run: npm run smoke',
      '  portal:', '    timeout-minutes: 20', '    steps:', '      - run: echo',
    ].join('\n')
    expect(parseTimeouts(yaml)).toEqual({ verify: 40, 'verify / Smoke test': 32, portal: 20 })
  })
})

describe('isDocsOnly', () => {
  it('only docs, markdown and agent prompts, minus the docs unit tests read', () => {
    expect(isDocsOnly(['docs/agents/DECISIONS.md', 'README.md', 'docs/reports/x.jpg'])).toBe(true)
    expect(isDocsOnly(['docs/x.md', 'src/app/App.tsx'])).toBe(false)
    expect(isDocsOnly(['e2e/README.md'])).toBe(true)
    expect(isDocsOnly([])).toBe(false)
    expect(isDocsOnly(['docs/audio/SCORE-FORMAT.md'])).toBe(false)
  })
})

describe('findings', () => {
  it('a game job failing on a docs-only PR is flaky, with its error', () => {
    const r = run({ jobs: [job('verify', 'failure', 25, [{ name: 'Smoke test every level', conclusion: 'failure' }], { errors: ['FAIL level1 leaderboard'] })] })
    const f = findings(snap({ runs: [r], prFiles: docsPr }))
    expect(f.map((x: { key: string }) => x.key)).toEqual(['flaky:verify / Smoke test every level'])
    expect(f[0].body).toContain('touches docs only')
    expect(f[0].body).toContain('FAIL level1 leaderboard')
    expect(f[0].owner).toBe('agents')
    expect(f[0].lastSeen).toBe(Date.parse(r.created_at))
  })

  it('a failure on a code PR is the PR\'s, unless the same commit passed elsewhere', () => {
    const failed = smokeFail()
    expect(keys(snap({ runs: [failed], prFiles: { 10: ['src/x.ts'] } }))).toEqual([])
    const passed = run({ id: 2, conclusion: 'success', jobs: [] })
    expect(keys(snap({ runs: [failed, passed], prFiles: { 10: ['src/x.ts'] } }))).toEqual(['flaky:verify / Smoke'])
  })

  it('a docs-only PR failing while main is red is not a flake', () => {
    const red = onMain({ created_at: iso(3 * H), head_sha: 'm', jobs: [job('verify', 'failure', 1)] })
    expect(keys(snap({ runs: [red, smokeFail()], prFiles: docsPr }))).toEqual([])
  })

  it('a timed-out job is a timeout, not also a flake', () => {
    const r = run({ jobs: [job('verify', 'failure', 10, [{ name: 'Smoke', conclusion: 'failure', started_at: iso(10 * 60e3 + H), completed_at: iso(H) }], { timedOut: true })] })
    expect(keys(snap({ runs: [r], prFiles: docsPr }))).toEqual(['timeout:.github/workflows/ci.yml:verify / Smoke'])
  })

  it('main is red only when the newest run on main failed, in a workflow that doesn\'t alert itself', () => {
    const automerge = (over: object) => onMain({ path: '.github/workflows/automerge.yml', name: 'Auto-merge', ...over })
    const old = automerge({ created_at: iso(5 * H), head_sha: 'b', jobs: [job('merge', 'failure', 1)] })
    const fresh = automerge({ created_at: iso(1 * H), conclusion: 'success', head_sha: 'c' })
    expect(keys(snap({ runs: [old, fresh] }))).toEqual([])
    const [red] = findings(snap({ runs: [old] }))
    expect(red.key).toBe('main-red:.github/workflows/automerge.yml')
    expect(red.body).toContain('When main breaks')
  })

  it('ci.yml\'s verify gate and prod-smoke.yml alert themselves on main; ci.yml\'s portal job doesn\'t', () => {
    const ci = (j: object) => onMain({ jobs: [j] })
    expect(keys(snap({ runs: [ci(job('smoke (level1)', 'failure', 9))] }))).toEqual([])
    expect(keys(snap({ runs: [ci(job('portal', 'failure', 9))] }))).toEqual(['main-red:.github/workflows/ci.yml'])
    const prod = onMain({ event: 'deployment_status', path: '.github/workflows/prod-smoke.yml', jobs: [job('check', 'failure', 3)] })
    expect(keys(snap({ runs: [prod] }))).toEqual([])
  })

  it('a step that ran into its own limit, or a timed-out annotation, is a timeout', () => {
    const timeouts = { '.github/workflows/prod-smoke.yml': { smoke: 40, 'smoke / Smoke test production': 32 } }
    const step = { name: 'Smoke test production', conclusion: 'failure', started_at: iso(33 * 60e3 + H), completed_at: iso(H) }
    const r = onMain({ path: '.github/workflows/prod-smoke.yml', event: 'deployment_status', jobs: [job('smoke', 'failure', 34, [step])] })
    const f = findings(snap({ runs: [r], timeouts }))
    expect(f.find((x: { key: string }) => x.key.startsWith('timeout:'))?.title).toBe('Timeout: smoke / Smoke test production hit its 32 min limit')
    const annotated = run({ jobs: [job('verify', 'failure', 10, [{ name: 'Smoke', conclusion: 'failure', started_at: iso(10 * 60e3 + H), completed_at: iso(H) }], { timedOut: true })] })
    expect(keys(snap({ runs: [annotated], prFiles: { 10: ['src/a.ts'] } }))).toContain('timeout:.github/workflows/ci.yml:verify / Smoke')
  })

  it('runtime creep: median of successful runs at 75 % of the limit or more', () => {
    const timeouts = { '.github/workflows/ci.yml': { verify: 40 } }
    const ok = (mins: number, id: number) => run({ id, conclusion: 'success', head_sha: `s${id}`, jobs: [job('verify', 'success', mins)] })
    expect(keys(snap({ runs: [ok(20, 1), ok(22, 2), ok(25, 3)], timeouts }))).toEqual([])
    expect(keys(snap({ runs: [ok(30, 1), ok(31, 2), ok(33, 3)], timeouts }))).toEqual(['creep:.github/workflows/ci.yml::verify'])
  })

  it('a job well past main\'s limit ran an older workflow file: no timeout or creep from it', () => {
    const timeouts = { '.github/workflows/ci.yml': { verify: 5 } }
    const ok = (mins: number, id: number) => run({ id, conclusion: 'success', head_sha: `s${id}`, jobs: [job('verify', 'success', mins)] })
    expect(keys(snap({ runs: [ok(34, 1), ok(33, 2), ok(35, 3)], timeouts }))).toEqual([])
  })

  it('closed after a fix, the old runs still in the window file nothing; a newer run files it again', () => {
    const timeouts = { '.github/workflows/ci.yml': { verify: 40 } }
    const ok = (mins: number, id: number, hAgo: number) =>
      run({ id, conclusion: 'success', head_sha: `s${id}`, created_at: iso(hAgo * H), jobs: [job('verify', 'success', mins)] })
    const closedAt = { 'creep:.github/workflows/ci.yml::verify': NOW - 10 * H, 'flaky:verify / Smoke': NOW - 10 * H }
    expect(keys(snap({ runs: [ok(30, 1, 20), ok(31, 2, 19), ok(33, 3, 18)], timeouts, closedAt }))).toEqual([])
    expect(keys(snap({ runs: [smokeFail({ created_at: iso(12 * H) })], prFiles: docsPr, closedAt }))).toEqual([])
    const again = findings(snap({ runs: [smokeFail({ created_at: iso(12 * H) }), smokeFail({ created_at: iso(2 * H) })], prFiles: docsPr, closedAt }))
    expect(again.map((f: { key: string }) => f.key)).toEqual(['flaky:verify / Smoke'])
    expect(again[0].lastSeen).toBe(NOW - 2 * H)
  })

  describe('stalled: Builders / QA slots (EST: 08:47, 10:17, …) missed 2 h past their time', () => {
    const lastNight = Date.parse('2026-11-04T01:40:00Z')
    const ready = [{ number: 1, title: 't', labels: ['agent:ready'], created_at: iso(H) }]
    const inQa = [{ number: 2, title: 'p', labels: ['agent:needs-qa'], created_at: iso(H), updated_at: iso(H) }]
    const at = (utc: string, over: object = {}) =>
      snap({ now: Date.parse(utc), lastAgentActivity: lastNight, openIssues: ready, openPrs: inQa, ...over })

    it('the normal overnight gap (last post 20:40, now 03:36 or 11:00) is not a stall', () => {
      expect(keys(at('2026-11-04T08:36:00Z'))).toEqual([])
      expect(keys(at('2026-11-04T16:00:00Z'))).toEqual([])
    })

    it('at 14:00, Builders 08:47 and QA 10:17 missed with work queued: Alex\'s', () => {
      const f = findings(at('2026-11-04T19:00:00Z'))
      expect(f.map((x: { key: string; owner: string }) => [x.key, x.owner])).toEqual([['stalled', 'alex']])
      expect(f[0].state).toBe(true)
    })

    it('slots with nothing queued for that role, a pause, or an empty queue are not a stall', () => {
      expect(keys(at('2026-11-04T19:00:00Z', { openPrs: [] }))).toEqual([])
      expect(keys(at('2026-11-04T19:00:00Z', { paused: true }))).toEqual([])
      expect(keys(at('2026-11-04T19:00:00Z', { openIssues: [], openPrs: [] }))).toEqual([])
    })
  })

  it('stuck approvals and a QA backlog, timed from the label', () => {
    const f = keys(snap({
      openPrs: [
        { number: 5, title: 'a', labels: ['agent:qa-approved'], created_at: iso(10 * H), updated_at: iso(H), labelledAt: { 'agent:qa-approved': iso(4 * H) } },
        { number: 6, title: 'b', labels: ['agent:needs-qa'], created_at: iso(30 * H), updated_at: iso(26 * H) },
        { number: 7, title: 'c', labels: ['agent:needs-qa'], created_at: iso(3 * H), updated_at: iso(2 * H) },
      ],
    }))
    expect(f).toEqual(['stuck-approved:5', 'qa-backlog'])
  })

  it('a production alert open over 12 h is escalated in place, not filed again', () => {
    const s = snap({
      openIssues: [
        { number: 9, title: 'p', labels: ['agent:prod-broken'], created_at: iso(13 * H) },
        { number: 8, title: 'q', labels: ['agent:prod-broken'], created_at: iso(2 * H) },
      ],
    })
    expect(keys(s)).toEqual([])
    expect(staleProdAlerts(s).map((i: { number: number }) => i.number)).toEqual([9])
  })
})

type Params = Record<string, unknown>
const fakeApi = (replies: Record<string, unknown> = {}) => {
  const calls: [string, Params][] = []
  const api = async (route: string, params: Params = {}) => {
    calls.push([route, params])
    if (route === 'POST /repos/{owner}/{repo}/issues') return { number: 100 }
    return replies[route] ?? []
  }
  return { api, calls, routes: () => calls.map(([r]) => r) }
}
const COMMENT = 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments'
const ADD_LABELS = 'POST /repos/{owner}/{repo}/issues/{issue_number}/labels'
const PATCH = 'PATCH /repos/{owner}/{repo}/issues/{issue_number}'

describe('reconcile', () => {
  const finding = (over: object = {}) => ({ key: 'flaky:verify / Smoke', title: 'Flaky', owner: 'agents', body: 'b', lastSeen: NOW - H, ...over })
  const issue = (over: object = {}) => ({ number: 3, title: 'Flaky', created_at: iso(2 * H), labels: [], body: '<!-- studio-health:flaky:verify / Smoke -->\nb', ...over })
  const log = () => {}

  it('opens one issue per new problem: agent:ready for agents, needs-alex for Alex', async () => {
    const { api, calls } = fakeApi()
    await reconcile(api, [finding(), finding({ key: 'stalled', owner: 'alex', state: true, lastSeen: NOW })], [], NOW, log)
    const opened = calls.filter(([r]) => r === 'POST /repos/{owner}/{repo}/issues').map(([, p]) => p)
    expect(opened.map((p) => p.labels)).toEqual([
      ['studio-health', 'P1', 'type:tech', 'agent:ready'],
      ['studio-health', 'P1', 'type:tech', 'needs-alex'],
    ])
    expect(opened[0].body).toContain('<!-- studio-health:flaky:verify / Smoke -->')
    expect(opened[0].body).toContain('**Last seen:** 2026-11-04T15:00Z')
  })

  it('updates the open issue instead of opening another', async () => {
    const { api, routes } = fakeApi()
    await reconcile(api, [finding()], [issue()], NOW, log)
    expect(routes()).toEqual(['POST /repos/{owner}/{repo}/labels', PATCH])
  })

  it('escalates once: open over 24 h and seen in the last 24 h; the body marker, not the label, remembers it', async () => {
    const first = fakeApi()
    await reconcile(first.api, [finding()], [issue({ created_at: iso(30 * H) })], NOW, log)
    expect(first.routes()).toEqual(['POST /repos/{owner}/{repo}/labels', PATCH, ADD_LABELS, COMMENT])
    const patched = first.calls.find(([r]) => r === PATCH)![1]
    expect(patched.body).toContain('<!-- studio-health-escalated -->')

    const next = fakeApi()
    await reconcile(next.api, [finding()], [issue({ created_at: iso(30 * H), labels: [], body: patched.body, title: patched.title })], NOW, log)
    expect(next.routes()).toEqual(['POST /repos/{owner}/{repo}/labels'])
  })

  it('doesn\'t escalate a problem last seen over 24 h ago', async () => {
    const { api, routes } = fakeApi()
    await reconcile(api, [finding({ lastSeen: NOW - 30 * H })], [issue({ created_at: iso(30 * H) })], NOW, log)
    expect(routes()).not.toContain(COMMENT)
    expect(routes()).not.toContain(ADD_LABELS)
  })

  it('closes an issue whose problem cleared', async () => {
    const { api, calls } = fakeApi()
    await reconcile(api, [], [issue()], NOW, log)
    expect(calls.find(([r]) => r === PATCH)![1]).toMatchObject({ issue_number: 3, state: 'closed' })
  })
})

describe('escalateProdAlerts', () => {
  const alert = { number: 9, title: 'p', labels: ['agent:prod-broken'], created_at: iso(13 * H) }
  const LIST = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments'

  it('adds needs-alex and one marked comment', async () => {
    const { api, calls, routes } = fakeApi()
    await escalateProdAlerts(api, [alert], NOW, () => {})
    expect(routes()).toEqual([LIST, ADD_LABELS, COMMENT])
    expect(calls[2][1].body).toContain('<!-- studio-health-escalated -->')
  })

  it('skips an alert it already escalated', async () => {
    const { api, routes } = fakeApi({ [LIST]: [{ body: '<!-- studio-health-escalated -->\nEscalating' }] })
    await escalateProdAlerts(api, [alert], NOW, () => {})
    expect(routes()).toEqual([LIST])
  })
})
