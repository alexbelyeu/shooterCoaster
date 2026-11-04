import { describe, expect, it } from 'vitest'
import rules from './studioHealthRules.cjs'

const { findings, parseTimeouts, isDocsOnly } = rules

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
const snap = (over: object) => ({
  now: NOW, runs: [], prFiles: {}, timeouts: {}, openPrs: [], openIssues: [], lastAgentActivity: NOW - H, paused: false, ...over,
})
const keys = (s: object) => findings(s).map((f: { key: string }) => f.key)

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
  it('only docs, markdown and agent prompts', () => {
    expect(isDocsOnly(['docs/agents/DECISIONS.md', 'README.md', 'docs/reports/x.jpg'])).toBe(true)
    expect(isDocsOnly(['docs/x.md', 'src/app/App.tsx'])).toBe(false)
    expect(isDocsOnly(['e2e/README.md'])).toBe(true)
    expect(isDocsOnly([])).toBe(false)
  })
})

describe('findings', () => {
  it('a game job failing on a docs-only PR is flaky, with its error', () => {
    const r = run({ jobs: [job('verify', 'failure', 25, [{ name: 'Smoke test every level', conclusion: 'failure' }], { errors: ['FAIL level1 leaderboard'] })] })
    const f = findings(snap({ runs: [r], prFiles: { 10: ['docs/a.md'] } }))
    expect(f.map((x: { key: string }) => x.key)).toEqual(['flaky:verify / Smoke test every level'])
    expect(f[0].body).toContain('touches docs only')
    expect(f[0].body).toContain('FAIL level1 leaderboard')
    expect(f[0].owner).toBe('agents')
  })

  it('a failure on a code PR is the PR\'s, unless the same commit passed elsewhere', () => {
    const failed = run({ jobs: [job('verify', 'failure', 25, [{ name: 'Smoke', conclusion: 'failure' }])] })
    expect(keys(snap({ runs: [failed], prFiles: { 10: ['src/x.ts'] } }))).toEqual([])
    const passed = run({ id: 2, conclusion: 'success', jobs: [] })
    expect(keys(snap({ runs: [failed, passed], prFiles: { 10: ['src/x.ts'] } }))).toEqual(['flaky:verify / Smoke'])
  })

  it('main is red only when the newest completed run on main failed', () => {
    const old = run({ event: 'push', head_branch: 'main', prNumber: null, created_at: iso(5 * H), conclusion: 'failure', head_sha: 'b' })
    const fresh = run({ event: 'push', head_branch: 'main', prNumber: null, created_at: iso(1 * H), conclusion: 'success', head_sha: 'c' })
    expect(keys(snap({ runs: [old, fresh] }))).toEqual([])
    expect(keys(snap({ runs: [old] }))).toEqual(['main-red:.github/workflows/ci.yml'])
  })

  it('a step that ran into its own limit, or a timed-out annotation, is a timeout', () => {
    const timeouts = { '.github/workflows/prod-smoke.yml': { smoke: 40, 'smoke / Smoke test production': 32 } }
    const step = { name: 'Smoke test production', conclusion: 'failure', started_at: iso(33 * 60e3 + H), completed_at: iso(H) }
    const r = run({ path: '.github/workflows/prod-smoke.yml', event: 'deployment_status', head_branch: 'main', prNumber: null, jobs: [job('smoke', 'failure', 34, [step])] })
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

  it('a stalled studio is Alex\'s, and a pause or an empty queue is not a stall', () => {
    const queued = { openIssues: [{ number: 1, title: 't', labels: ['agent:ready'], created_at: iso(H) }] }
    const stalled = findings(snap({ ...queued, lastAgentActivity: NOW - 8 * H }))
    expect(stalled.map((x: { key: string; owner: string }) => [x.key, x.owner])).toEqual([['stalled', 'alex']])
    expect(keys(snap({ ...queued, lastAgentActivity: NOW - 8 * H, paused: true }))).toEqual([])
    expect(keys(snap({ lastAgentActivity: NOW - 8 * H }))).toEqual([])
    expect(keys(snap({ ...queued, lastAgentActivity: NOW - 2 * H }))).toEqual([])
  })

  it('stuck approvals, a QA backlog and a stale prod alert', () => {
    const f = keys(snap({
      openPrs: [
        { number: 5, title: 'a', labels: ['agent:qa-approved'], created_at: iso(10 * H), updated_at: iso(4 * H) },
        { number: 6, title: 'b', labels: ['agent:needs-qa'], created_at: iso(30 * H), updated_at: iso(26 * H) },
        { number: 7, title: 'c', labels: ['agent:needs-qa'], created_at: iso(3 * H), updated_at: iso(2 * H) },
      ],
      openIssues: [{ number: 9, title: 'p', labels: ['agent:prod-broken'], created_at: iso(13 * H) }],
    }))
    expect(f).toEqual(['stuck-approved:5', 'qa-backlog', 'prod-broken:9'])
  })

  it('every finding carries when it was last seen when it comes from a run', () => {
    const r = run({ event: 'push', head_branch: 'main', prNumber: null })
    const [f] = findings(snap({ runs: [r] }))
    expect(f.lastSeen).toBe(Date.parse(r.created_at))
  })
})
