import { describe, expect, it } from 'vitest'
import gate from './automerge.cjs'

const REPO = 'alexbelyeu/shootercoaster'
const SHA = 'abc1234def'
const pr = (number: number, over: Record<string, unknown> = {}) => ({
  number, state: 'open', draft: false, title: `PR ${number}`,
  labels: [{ name: 'agent:qa-approved' }],
  base: { ref: 'main' },
  head: { ref: `agent/${number}-x`, sha: `${SHA}${number}`, repo: { full_name: REPO } },
  ...over,
})
const verify = (status: string, conclusion: string | null = null, started_at = '2026-10-30T20:00:00Z') =>
  ({ status, conclusion, started_at })
const green = verify('completed', 'success')

describe('decide', () => {
  it('merges an approved agent PR into main with verify green', () => {
    expect(gate.decide(pr(1), green, REPO).action).toBe('merge')
  })

  it('waits silently while verify runs, and ignores unapproved or closed PRs', () => {
    expect(gate.decide(pr(1), verify('in_progress'), REPO)).toEqual({ action: 'wait', reason: '`verify` is in progress' })
    expect(gate.decide(pr(1), verify('queued'), REPO).action).toBe('wait')
    expect(gate.decide(pr(1, { labels: [{ name: 'agent:needs-qa' }] }), green, REPO).action).toBe('ignore')
    expect(gate.decide(pr(1, { state: 'closed' }), green, REPO).action).toBe('ignore')
  })

  it('keeps every safety check and names the reason', () => {
    const skip = (p: object, v: object = green) => gate.decide(p, v, REPO)
    expect(skip(pr(1, { draft: true }))).toEqual({ action: 'skip', reason: 'the PR is a draft' })
    expect(skip(pr(1, { base: { ref: 'dev' } })).reason).toContain('`dev`')
    expect(skip(pr(1, { head: { ref: 'agent/1', sha: SHA, repo: { full_name: 'evil/fork' } } })).reason).toContain('fork')
    // Repo names are case-insensitive on GitHub (the API returns shooterCoaster).
    expect(skip(pr(1, { head: { ref: 'agent/1', sha: SHA, repo: { full_name: 'alexbelyeu/shooterCoaster' } } })).action).toBe('merge')
    expect(skip(pr(1, { head: { ref: 'feature/x', sha: SHA, repo: { full_name: REPO } } })).reason).toContain('`feature/x`')
    expect(gate.decide(pr(1), undefined, REPO).reason).toContain('no `verify` check')
    expect(skip(pr(1), verify('completed', 'failure'))).toEqual({ action: 'skip', reason: '`verify` is failure on the head commit' })
  })
})

describe('candidate selection', () => {
  it('the sweep takes every open approved PR', () => {
    const open = [pr(5), pr(3, { labels: [{ name: 'agent:needs-qa' }] }), pr(2), pr(9, { labels: [] })]
    expect(gate.sweepNumbers(open)).toEqual([2, 5])
  })

  it('unions the CI lookups', () => {
    expect(gate.unionNumbers([{ number: 4 }], [], [{ number: 4 }, { number: 2 }])).toEqual([2, 4])
  })

  it('latestVerify takes the newest run', () => {
    const old = verify('completed', 'failure', '2026-10-30T19:00:00Z')
    expect(gate.latestVerify([old, green])).toBe(green)
  })
})

describe('shouldComment', () => {
  const bot = (body: string, created_at: string) => ({ body, created_at, user: { type: 'Bot' } })
  const body = gate.skipComment('`verify` is failure on the head commit', SHA)

  it('says it once per reason and head', () => {
    expect(gate.shouldComment(body, [])).toBe(true)
    expect(gate.shouldComment(body, [bot(body, '2026-10-30T20:00:00Z')])).toBe(false)
    // Human comments in between don't matter; only the latest auto-merge comment does.
    expect(gate.shouldComment(body, [bot(body, '2026-10-30T20:00:00Z'), { body: 'hi', created_at: '2026-10-30T21:00:00Z', user: { type: 'User' } }])).toBe(false)
  })

  it('speaks again for a new head or a new reason', () => {
    const other = gate.failComment('Pull Request is not mergeable', SHA)
    expect(gate.shouldComment(body, [bot(body, '2026-10-30T20:00:00Z'), bot(other, '2026-10-30T20:10:00Z')])).toBe(true)
    expect(gate.shouldComment(gate.skipComment('`verify` is failure on the head commit', 'fff0000'), [bot(body, '2026-10-30T20:00:00Z')])).toBe(true)
  })
})

/** A fake REST API: open PRs, verify per head SHA, comments; records writes. */
function fakeApi(opts: { prs: ReturnType<typeof pr>[]; verify?: Record<string, object>; comments?: Record<number, object[]>; commitPrs?: object[]; mergeError?: string }) {
  const writes: { route: string; params: Record<string, unknown> }[] = []
  const api = async (route: string, params: Record<string, any> = {}) => {
    if (route.startsWith('GET')) {
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        const head = params.head?.split(':')[1]
        return opts.prs.filter((p) => p.state === 'open' && (!head || p.head.ref === head))
      }
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') return opts.prs.find((p) => p.number === params.pull_number)
      if (route === 'GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls') return opts.commitPrs ?? []
      if (route === 'GET /repos/{owner}/{repo}/commits/{ref}/check-runs') {
        const v = opts.verify?.[params.ref]
        return { check_runs: v ? [v] : [] }
      }
      if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments') return opts.comments?.[params.issue_number] ?? []
      if (route === 'GET /repos/{owner}/{repo}/branches/{branch}') return { commit: { sha: 'main000999' } }
      throw new Error(`unexpected ${route}`)
    }
    writes.push({ route, params })
    if (route.includes('/merge') && opts.mergeError) throw new Error(opts.mergeError)
    return {}
  }
  const warnings: string[] = []
  const log = { info: () => {}, warning: (m: string) => warnings.push(m) }
  return { api, writes, warnings, log }
}

const run = (f: ReturnType<typeof fakeApi>, event: string, payload: object = {}, dryRun = false) =>
  gate.runGate({ api: f.api, event, payload, owner: 'alexbelyeu', repo: 'shootercoaster', dryRun, log: f.log })

describe('runGate', () => {
  it('the sweep merges an approved PR with verify green and dispatches CI on main', async () => {
    const f = fakeApi({
      prs: [pr(234), pr(240, { labels: [{ name: 'agent:needs-qa' }] }), pr(241)],
      verify: { [`${SHA}234`]: green, [`${SHA}240`]: green, [`${SHA}241`]: verify('in_progress') },
    })
    const res = await run(f, 'schedule')
    expect(res.numbers).toEqual([234, 241])
    expect(res.merged).toEqual([234])
    expect(f.writes.map((w) => w.route)).toEqual([
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
      'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
    ])
    expect(f.writes[0].params).toMatchObject({ pull_number: 234, sha: `${SHA}234`, merge_method: 'squash', commit_title: 'PR 234 (#234)' })
    expect(f.writes[1].params).toMatchObject({ workflow_id: 'ci.yml', ref: 'main', inputs: { merged: '#234 (main000)' } })
    expect(res.lines).toEqual([`#234: merged (abc1234)`, `#241: waiting: \`verify\` is in progress (abc1234)`])
  })

  it('after CI, finds the PR by branch when the commit lookup comes back empty (#234)', async () => {
    const f = fakeApi({ prs: [pr(234)], verify: { [`${SHA}234`]: green }, commitPrs: [] })
    const payload = { workflow_run: { id: 1, head_branch: 'agent/234-x', head_sha: `${SHA}234`, pull_requests: [] } }
    expect((await run(f, 'workflow_run', payload)).merged).toEqual([234])
    expect(f.warnings).toEqual([])
  })

  it('warns visibly when CI on an agent branch maps to no PR', async () => {
    const f = fakeApi({ prs: [] })
    await run(f, 'workflow_run', { workflow_run: { id: 7, head_branch: 'agent/9-x', head_sha: SHA, pull_requests: [] } })
    expect(f.warnings[0]).toContain('no open PR found')
    const main = fakeApi({ prs: [] })
    await run(main, 'workflow_run', { workflow_run: { id: 8, head_branch: 'main', head_sha: SHA, pull_requests: [] } })
    expect(main.warnings).toEqual([])
  })

  it('comments a skip on an approved PR once, never while verify runs', async () => {
    const red = fakeApi({ prs: [pr(7)], verify: { [`${SHA}7`]: verify('completed', 'failure') } })
    await run(red, 'schedule')
    expect(red.writes).toHaveLength(1)
    expect(red.writes[0].params.body).toMatch(/^Auto-merge skipped: `verify` is failure on the head commit\.\nHead: `abc1234def7`/)

    const again = fakeApi({
      prs: [pr(7)], verify: { [`${SHA}7`]: verify('completed', 'failure') },
      comments: { 7: [{ body: red.writes[0].params.body, created_at: '2026-10-30T20:00:00Z', user: { type: 'Bot' } }] },
    })
    await run(again, 'schedule')
    expect(again.writes).toEqual([])

    const running = fakeApi({ prs: [pr(7)], verify: { [`${SHA}7`]: verify('queued') } })
    await run(running, 'schedule')
    expect(running.writes).toEqual([])
  })

  it('comments a failed merge once and keeps going', async () => {
    const f = fakeApi({ prs: [pr(7), pr(8)], verify: { [`${SHA}7`]: green, [`${SHA}8`]: green }, mergeError: 'Pull Request is not mergeable' })
    const res = await run(f, 'schedule')
    expect(res.merged).toEqual([])
    const comments = f.writes.filter((w) => w.route.endsWith('/comments'))
    expect(comments.map((c) => c.params.issue_number)).toEqual([7, 8])
    expect(comments[0].params.body).toMatch(/^Auto-merge failed: Pull Request is not mergeable/)
    expect(f.writes.some((w) => w.route.includes('dispatches'))).toBe(false)
  })

  it('a dry run writes nothing', async () => {
    const f = fakeApi({ prs: [pr(1), pr(2, { draft: true })], verify: { [`${SHA}1`]: green, [`${SHA}2`]: green } })
    const res = await run(f, 'workflow_dispatch', { inputs: { dry_run: 'true' } }, true)
    expect(f.writes).toEqual([])
    expect(res.lines[0]).toBe('#1: [dry run] would merge (abc1234)')
  })
})
