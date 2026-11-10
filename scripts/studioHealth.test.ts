import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import rules from './studioHealthRules.cjs'
import watchdog from './studio-health.cjs'
import status from './studio-status.cjs'

const { findings, staleProdAlerts, waitingProdAlerts, nightlyOverdue, parseTimeouts, isDocsOnly, ALERTED_ON_MAIN } = rules
const { pauseUntil } = status
const ciYaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const { reconcile, escalateProdAlerts, noteWaitingProdAlerts, dispatchOverdueNightly, prodSuites } = watchdog

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

  it('the real ci.yml: every job has a limit, a matrix job under its base name', () => {
    expect(parseTimeouts(ciYaml)).toMatchObject({ 'unit + build': expect.any(Number), lighthouse: expect.any(Number), smoke: expect.any(Number), verify: expect.any(Number), portal: expect.any(Number) })
  })
})

describe('ALERTED_ON_MAIN', () => {
  it('covers ci.yml\'s verify gate and every job it needs (they open agent:prod-broken on main), not portal', () => {
    const job = (id: string) => ciYaml.split('\n').slice(ciYaml.split('\n').indexOf(`  ${id}:`))
    const nameOf = (id: string) => job(id).find((l) => /^ {4}name:/.test(l))!.replace(/^ {4}name:\s*/, '').replace(/\s*\(.*\)$/, '')
    const needs = job('verify').find((l) => /^ {4}needs:/.test(l))!.match(/\[(.*)\]/)![1].split(',').map((s) => s.trim())
    expect(needs.length).toBeGreaterThan(0)
    const alerted = ALERTED_ON_MAIN['.github/workflows/ci.yml']
    for (const id of ['verify', ...needs]) expect(alerted.test(nameOf(id)), id).toBe(true)
    expect(alerted.test(nameOf('portal'))).toBe(false)
  })
})

describe('pauseUntil', () => {
  it('reads a PAUSE until title in New York time, like pause-check.sh', () => {
    expect(pauseUntil('PAUSE until 2026-11-04 08:00')).toBe(Date.parse('2026-11-04T13:00:00Z'))
    expect(pauseUntil('PAUSE until 2026-10-21')).toBe(Date.parse('2026-10-21T04:00:00Z'))
    expect(pauseUntil('PAUSE')).toBe(null)
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

  it('a smoke shard failing fails the verify gate too: one finding, the shard\'s (#401)', () => {
    const r = run({ jobs: [
      job('smoke (mobile)', 'failure', 5, [{ name: 'Smoke shard mobile', conclusion: 'failure' }]),
      job('verify', 'failure', 1, [{ name: 'Unit tests, Lighthouse and every smoke shard passed', conclusion: 'failure' }]),
    ] })
    expect(keys(snap({ runs: [r], prFiles: docsPr }))).toEqual(['flaky:smoke / Smoke shard mobile'])
    // The gate failing alone (nothing it needs failed) is still filed.
    const alone = run({ jobs: [job('verify', 'failure', 1, [{ name: 'Report a red main', conclusion: 'failure' }])] })
    expect(keys(snap({ runs: [alone], prFiles: docsPr }))).toEqual(['flaky:verify / Report a red main'])
  })

  it('a failure on a code PR is the PR\'s, unless the same commit passed elsewhere', () => {
    const failed = smokeFail()
    expect(keys(snap({ runs: [failed], prFiles: { 10: ['src/x.ts'] } }))).toEqual([])
    const passed = run({ id: 2, conclusion: 'success', jobs: [job('verify', 'success', 20)] })
    expect(keys(snap({ runs: [failed, passed], prFiles: { 10: ['src/x.ts'] } }))).toEqual(['flaky:verify / Smoke'])
  })

  it('only the same job passing on that commit makes a flake: prod-smoke\'s deploy passing says nothing about nightly', () => {
    const prod = (over: object) => onMain({ path: '.github/workflows/prod-smoke.yml', name: 'Production smoke', head_sha: 'm1', ...over })
    const deploy = prod({ id: 1, event: 'deployment_status', conclusion: 'success', created_at: iso(5 * H), jobs: [job('deploy', 'success', 3)] })
    const nightly = prod({ id: 2, event: 'schedule', created_at: iso(2 * H), jobs: [job('nightly', 'failure', 20, [{ name: 'Smoke', conclusion: 'failure' }])] })
    expect(keys(snap({ runs: [deploy, nightly] }))).toEqual([])
    const nightlyOk = prod({ id: 3, event: 'schedule', conclusion: 'success', created_at: iso(H), jobs: [job('nightly', 'success', 20)] })
    expect(keys(snap({ runs: [deploy, nightly, nightlyOk] }))).toEqual(['flaky:nightly / Smoke'])
  })

  it('a job red on main and green on the next main commit is flaky when that commit touched nothing a check depends on (#487)', () => {
    const shard = (conclusion: string) => job('smoke (level2)', conclusion, 6, conclusion === 'failure' ? [{ name: 'Smoke shard level2', conclusion: 'failure' }] : [])
    const red = onMain({ id: 1, event: 'workflow_dispatch', head_sha: 'm1', created_at: iso(5 * H), jobs: [shard('failure')] })
    const green = onMain({ id: 2, event: 'workflow_dispatch', head_sha: 'm2', conclusion: 'success', created_at: iso(3 * H), jobs: [shard('success')] })
    const withDiff = (files: string[]) => snap({ runs: [red, green], mainDiffs: { 'm1...m2': files } })
    const f = findings(withDiff(['docs/agents/STATE.md', '.claude/agents/qa.md']))
    expect(f.map((x: { key: string }) => x.key)).toEqual(['flaky:smoke / Smoke shard level2'])
    expect(f[0].body).toContain('passed on the next main commit')
    expect(keys(withDiff(['src/levels/LevelRegistry.ts']))).toEqual([])
    expect(keys(withDiff(['e2e/smoke.mjs']))).toEqual([])
    expect(keys(withDiff(['budgets.json']))).toEqual([])
    expect(keys(snap({ runs: [red, green] }))).toEqual([]) // no diff fetched
    const stillRed = { ...green, conclusion: 'failure', jobs: [shard('failure')] }
    expect(keys(snap({ runs: [red, stillRed], mainDiffs: { 'm1...m2': ['docs/a.md'] } }))).toEqual([])
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
    const marked = run({ jobs: [job('verify', 'failure', 30, [{ name: 'Smoke', conclusion: 'failure' }], { timedOut: true })] })
    expect(keys(snap({ runs: [marked], timeouts, prFiles: { 10: ['src/a.ts'] } }))).toEqual([])
  })

  it('smoke shards get the matrix job\'s limit from the real ci.yml (creep and timeouts see them)', () => {
    const timeouts = { '.github/workflows/ci.yml': parseTimeouts(ciYaml) }
    const limit = timeouts['.github/workflows/ci.yml'].smoke
    const ok = (id: number) => run({ id, conclusion: 'success', head_sha: `s${id}`, jobs: [job('smoke (level3)', 'success', limit - 1)] })
    expect(keys(snap({ runs: [ok(1), ok(2), ok(3)], timeouts }))).toEqual(['creep:.github/workflows/ci.yml::smoke'])
    const cutOff = run({ jobs: [job('smoke (level3)', 'failure', limit)] })
    expect(keys(snap({ runs: [cutOff], timeouts, prFiles: { 10: ['src/a.ts'] } }))).toEqual(['timeout:.github/workflows/ci.yml:smoke (level3)'])
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

    it('slots before the work was queued, or before the last pause ended, don\'t count', () => {
      // Ready at 12:00 and in QA at 12:30 EST: by 19:00 only the 13:47 Builders and 15:17 QA slots are 2 h old.
      const late = { openIssues: [{ ...ready[0], labelledAt: { 'agent:ready': '2026-11-04T17:00:00Z' } }], openPrs: [{ ...inQa[0], labelledAt: { 'agent:needs-qa': '2026-11-04T17:30:00Z' } }] }
      expect(keys(at('2026-11-04T19:00:00Z', late))).toEqual([])
      expect(keys(at('2026-11-05T00:00:00Z', late))).toEqual(['stalled'])
      expect(keys(at('2026-11-04T19:00:00Z', { pauseEndedAt: Date.parse('2026-11-04T17:00:00Z') }))).toEqual([])
    })

    it('Builders slots after the day\'s builder_runs_per_day was spent don\'t count', () => {
      const builderRuns = [1, 2, 3].map((h) => lastNight - h * H)
      const f = (budget: number) => keys(at('2026-11-04T23:00:00Z', { openPrs: [], builderRuns, builderBudget: budget }))
      expect(f(6)).toEqual(['stalled'])
      expect(f(3)).toEqual([])
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

  describe('an alert whose fix shipped waits for the nightly instead of escalating (#487)', () => {
    const alert = { number: 9, title: 'Production nightly smoke failing', labels: ['agent:prod-broken'], created_at: iso(30 * H), fixMergedAt: NOW - 20 * H, nightlyAlert: true }
    const with_ = (prod: object, over: object = {}) => snap({ openIssues: [{ ...alert, ...over }], prod })
    const nums = (xs: { number: number }[]) => xs.map((i) => i.number)
    const greenDeploy = { at: NOW - 19 * H, conclusion: 'success' }

    it('waits while the deploy check is green after the fix and no nightly went red since', () => {
      for (const nightly of [null, { at: NOW - 40 * H, conclusion: 'failure' }, { at: NOW - H, conclusion: null }, { at: NOW - H, conclusion: 'success' }]) {
        const s = with_({ deploy: greenDeploy, nightly })
        expect(nums(staleProdAlerts(s))).toEqual([])
        expect(nums(waitingProdAlerts(s))).toEqual([9])
      }
    })

    it('a red-main alert (no nightly marker) with a shipped fix still escalates', () => {
      const s = with_({ deploy: greenDeploy, nightly: null }, { nightlyAlert: false })
      expect(nums(staleProdAlerts(s))).toEqual([9])
      expect(nums(waitingProdAlerts(s))).toEqual([])
    })

    it('escalates without a linked fix, with the deploy check red or older than the fix, or a red nightly since', () => {
      expect(nums(staleProdAlerts(with_({ deploy: greenDeploy, nightly: null }, { fixMergedAt: null })))).toEqual([9])
      expect(nums(staleProdAlerts(with_({ deploy: { ...greenDeploy, conclusion: 'failure' }, nightly: null })))).toEqual([9])
      expect(nums(staleProdAlerts(with_({ deploy: { at: NOW - 21 * H, conclusion: 'success' }, nightly: null })))).toEqual([9])
      expect(nums(staleProdAlerts(with_({ deploy: greenDeploy, nightly: { at: NOW - H, conclusion: 'failure' } })))).toEqual([9])
      expect(nums(waitingProdAlerts(with_({ deploy: greenDeploy, nightly: { at: NOW - H, conclusion: 'failure' } })))).toEqual([])
    })
  })

  it('a nightly is overdue over 26 h after the last one started, or with none in the window', () => {
    expect(nightlyOverdue(snap({ prod: { nightly: { at: NOW - 25 * H, conclusion: 'success' }, deploy: null } }))).toBe(false)
    expect(nightlyOverdue(snap({ prod: { nightly: { at: NOW - 27 * H, conclusion: 'success' }, deploy: null } }))).toBe(true)
    expect(nightlyOverdue(snap({ prod: { nightly: null, deploy: null } }))).toBe(true)
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

describe('heavy runs', () => {
  const run = (role: string, weighted: number, hoursAgo: number, extra = {}) => ({
    role, ref: '#1', weighted, at: NOW - hoursAgo * H, minutes: 100, url: 'https://c', missTokens: 0, misses: 0, peakContext: null, missesAfter: [], heaviest: [], ...extra,
  })
  it('files one issue per role for runs over 5M in 48 h, with where the tokens went', () => {
    const f = findings(snap({
      ledgerRuns: [
        run('builders', 7e6, 2, {
          missTokens: 2.8e6, misses: 13, missesAfter: ['Bash: sleep 590; tail -12 log'],
          agents: [{ agent: 0, weighted: 0.3e6, turns: 20, peakContext: 90_000 }, { agent: 1, weighted: 6.7e6, turns: 240, peakContext: 399_000 }],
        }),
        run('builders', 6e6, 10),
        run('qa', 1e6, 1),
        run('maintainer', 9e6, 60),
      ],
    }))
    expect(f.map((x: { key: string }) => x.key)).toEqual(['heavy:builders'])
    expect(f[0].title).toBe('Token-heavy builders runs: 2 over 5M in 48 h')
    expect(f[0].body).toContain('2.8M of it 13 cache misses')
    expect(f[0].body).toContain('sleep 590')
    expect(f[0].body).toContain('by agent: main 0.3M / 20 turns / peak 90k, #1 6.7M / 240 turns / peak 399k')
    expect(f[0].lastSeen).toBe(NOW - 2 * H)
  })

  it('does not refile runs its closed issue already listed, only newer ones (#444)', () => {
    const ledgerRuns = [run('builders', 7e6, 30), run('builders', 7e6, 10)]
    expect(keys(snap({ ledgerRuns, closedAt: { 'heavy:builders': NOW - 5 * H } }))).toEqual([])
    const f = findings(snap({ ledgerRuns: [...ledgerRuns, run('builders', 6e6, 1)], closedAt: { 'heavy:builders': NOW - 5 * H } }))
    expect(f[0].title).toBe('Token-heavy builders runs: 1 over 5M in 48 h')
    expect(f[0].body).not.toContain('7.0M')
  })
})

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

  it('keeps player-* issues open while telemetry is unreachable, still closes the rest', async () => {
    const player = issue({ number: 4, body: '<!-- studio-health:player-error:abc -->\nb' })
    const down = fakeApi()
    await reconcile(down.api, [], [player, issue()], NOW, log, { telemetryDown: true })
    const closed = (c: [string, any][]) => c.filter(([r, p]) => r.startsWith('PATCH') && p.state === 'closed').map(([, p]) => p.issue_number)
    expect(closed(down.calls)).toEqual([3])
    const up = fakeApi()
    await reconcile(up.api, [], [player], NOW, log)
    expect(closed(up.calls)).toEqual([4])
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

describe('the nightly (#487)', () => {
  const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs'
  const DISPATCH = 'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches'
  const LIST = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments'

  it('prodSuites takes the newest run of each suite from the job that did not skip', async () => {
    const prodRun = (id: number, event: string, hAgo: number) => ({ id, path: '.github/workflows/prod-smoke.yml', event, created_at: iso(hAgo * H) })
    const jobsOf: Record<number, object[]> = {
      1: [{ name: 'deploy', status: 'completed', conclusion: 'success' }, { name: 'nightly', status: 'completed', conclusion: 'skipped' }],
      2: [],
      3: [{ name: 'deploy', status: 'completed', conclusion: 'failure' }, { name: 'nightly', status: 'completed', conclusion: 'skipped' }],
    }
    const api = async (route: string, params: Params = {}) => (route === JOBS ? { jobs: jobsOf[params.run_id as number] } : [])
    const prod = await prodSuites(api, [prodRun(3, 'deployment_status', 5), prodRun(2, 'schedule', 2), prodRun(1, 'workflow_dispatch', 1)])
    expect(prod).toEqual({ deploy: { at: NOW - H, conclusion: 'success' }, nightly: { at: NOW - 2 * H, conclusion: null } })
  })

  it('prodSuites still finds the scheduled nightly behind many skipped deploy runs', async () => {
    const run = (id: number, event: string, hAgo: number) => ({ id, path: '.github/workflows/prod-smoke.yml', event, created_at: iso(hAgo * H) })
    const skipped = [{ name: 'deploy', status: 'completed', conclusion: 'skipped' }, { name: 'nightly', status: 'completed', conclusion: 'skipped' }]
    const runs = [...Array.from({ length: 30 }, (_, k) => run(100 + k, 'deployment_status', 0.1 + k / 100)), run(1, 'schedule', 5)]
    const api = async (route: string, params: Params = {}) => (route === JOBS ? { jobs: params.run_id === 1 ? [] : skipped } : [])
    const prod = await prodSuites(api, runs)
    expect(prod.nightly).toEqual({ at: NOW - 5 * H, conclusion: null })
  })

  it('dispatches an overdue nightly on main, and nothing when it is on time', async () => {
    const late = fakeApi()
    await dispatchOverdueNightly(late.api, snap({ prod: { nightly: { at: NOW - 30 * H, conclusion: 'success' }, deploy: null } }), () => {})
    expect(late.calls).toEqual([[DISPATCH, { workflow_id: 'prod-smoke.yml', ref: 'main', inputs: { suite: 'nightly' } }]])
    const onTime = fakeApi()
    await dispatchOverdueNightly(onTime.api, snap({ prod: { nightly: { at: NOW - 10 * H, conclusion: 'success' }, deploy: null } }), () => {})
    expect(onTime.calls).toEqual([])
  })

  it('says once that a waiting alert waits for the nightly, and never escalates it', async () => {
    const alert = { number: 9, title: 'p', labels: ['agent:prod-broken'], created_at: iso(30 * H), fixMergedAt: NOW - 20 * H }
    const first = fakeApi()
    await noteWaitingProdAlerts(first.api, [alert], () => {})
    expect(first.routes()).toEqual([LIST, COMMENT])
    expect(first.calls[1][1].body).toContain('Waiting for the nightly to confirm')
    const again = fakeApi({ [LIST]: [{ body: first.calls[1][1].body }] })
    await noteWaitingProdAlerts(again.api, [alert], () => {})
    expect(again.routes()).toEqual([LIST])
  })
})
