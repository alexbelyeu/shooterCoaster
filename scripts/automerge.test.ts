import { readFileSync } from 'node:fs'
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
const verify = (status: string, conclusion: string | null = null, started_at = '2026-10-30T20:00:00Z', name = 'verify') =>
  ({ name, status, conclusion, started_at })
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
    expect(gate.decide(pr(1, { mergeable: false }), undefined, REPO).action).toBe('handback')
    expect(gate.decide(pr(1, { mergeable: null }), green, REPO).action).toBe('merge')
    expect(skip(pr(1, { draft: true, mergeable: false })).action).toBe('skip')
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

  it('latestVerify waits while the jobs verify needs run, before GitHub creates its check (#353)', () => {
    const shard = verify('in_progress', null, '2026-10-30T20:00:00Z', 'smoke (level3)')
    const portal = verify('in_progress', null, '2026-10-30T20:00:00Z', 'portal')
    const waiting = gate.latestVerify([verify('completed', 'success', '2026-10-30T20:00:00Z', 'unit + build'), shard])
    expect(gate.decide(pr(1), waiting, REPO)).toEqual({ action: 'wait', reason: '`verify` is waiting' })
    expect(gate.latestVerify([portal])).toBeUndefined()
    expect(gate.latestVerify([verify('completed', 'success', '2026-10-30T20:00:00Z', 'smoke (ui)')])).toBeUndefined()
    expect(gate.latestVerify([shard, green])).toBe(green)
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

/** A fake REST API: open PRs, verify per head SHA, comments; records writes. `fail` names the error a write throws. */
function fakeApi(opts: {
  prs: ReturnType<typeof pr>[]; verify?: Record<string, object>; comments?: Record<number, object[]>; commitPrs?: object[]
  fail?: (route: string, params: Record<string, any>) => string | undefined
}) {
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
    const error = opts.fail?.(route, params)
    if (error) throw new Error(error)
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

  const MERGE = 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge'
  const ADD_LABEL = 'POST /repos/{owner}/{repo}/issues/{issue_number}/labels'
  const REMOVE_LABEL = 'DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}'
  const COMMENT = 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments'
  const botSaid = (number: number, body: string) => ({ [number]: [{ body, created_at: '2026-10-30T20:00:00Z', user: { type: 'Bot' } }] })

  it('hands a conflicting PR back to Fix, then says nothing on the next sweep (#299)', async () => {
    const f = fakeApi({
      prs: [pr(7), pr(8)], verify: { [`${SHA}7`]: green, [`${SHA}8`]: green },
      fail: (route, p) => (route === MERGE && p.pull_number === 7 ? 'Pull Request is not mergeable' : undefined),
    })
    const res = await run(f, 'schedule')
    expect(res.merged).toEqual([8])
    const on7 = f.writes.filter((w) => w.params.issue_number === 7)
    expect(on7.map((w) => w.route)).toEqual([COMMENT, ADD_LABEL, REMOVE_LABEL])
    expect(on7[1].params.labels).toEqual(['agent:changes-requested'])
    expect(on7[2].params.name).toBe('agent:qa-approved')
    expect(on7[0].params.body).toBe(gate.handbackComment(`${SHA}7`))
    expect(on7[0].params.body).toMatch(/^Auto-merge failed: this branch conflicts with `main`\.\nHead: `abc1234def7`\. Merge conflict only; full review passed/)
    expect(res.lines).toContain('#7: handed back to Fix: it conflicts with main (abc1234)')

    const later = fakeApi({
      prs: [pr(7, { labels: [{ name: 'agent:changes-requested' }], mergeable: false })],
      verify: { [`${SHA}7`]: green }, comments: botSaid(7, on7[0].params.body),
    })
    expect((await run(later, 'schedule')).numbers).toEqual([])
    await run(later, 'pull_request', { pull_request: { number: 7 } })
    expect(later.writes).toEqual([])
  })

  it('hands back on either wording of the merge API\'s conflict answer', async () => {
    expect(gate.isConflictError('Pull Request is not mergeable')).toBe(true)
    expect(gate.isConflictError('Pull Request has merge conflicts')).toBe(true)
    expect(gate.isConflictError('Head branch was modified. Review and try the merge again.')).toBe(false)
    const f = fakeApi({
      prs: [pr(7)], verify: { [`${SHA}7`]: green },
      fail: (route) => (route === MERGE ? 'Pull Request has merge conflicts' : undefined),
    })
    await run(f, 'schedule')
    expect(f.writes.map((w) => w.route)).toEqual([MERGE, COMMENT, ADD_LABEL, REMOVE_LABEL])
  })

  it('hands back a PR GitHub already marks conflicting without waiting for verify', async () => {
    const f = fakeApi({ prs: [pr(7, { mergeable: false })] })
    await run(f, 'schedule')
    expect(f.writes.map((w) => w.route)).toEqual([COMMENT, ADD_LABEL, REMOVE_LABEL])
  })

  it('when a label call fails the PR stays approved, and the retry swaps labels without a second comment', async () => {
    const f = fakeApi({ prs: [pr(7, { mergeable: false })], fail: (route) => (route === ADD_LABEL ? 'boom' : undefined) })
    await run(f, 'schedule')
    expect(f.writes.map((w) => w.route)).toEqual([COMMENT, ADD_LABEL])
    const retry = fakeApi({ prs: [pr(7, { mergeable: false })], comments: botSaid(7, f.writes[0].params.body as string) })
    await run(retry, 'schedule')
    expect(retry.writes.map((w) => w.route)).toEqual([ADD_LABEL, REMOVE_LABEL])
  })

  it('any other merge failure keeps the PR approved and comments once', async () => {
    const f = fakeApi({ prs: [pr(7)], verify: { [`${SHA}7`]: green }, fail: (route) => (route === MERGE ? 'Base branch was modified' : undefined) })
    const res = await run(f, 'schedule')
    expect(res.merged).toEqual([])
    expect(f.writes.map((w) => w.route)).toEqual([MERGE, COMMENT])
    expect(f.writes[1].params.body).toMatch(/^Auto-merge failed: Base branch was modified\nHead: `abc1234def7`\. Retried/)
    expect(f.writes.some((w) => w.route.includes('dispatches'))).toBe(false)
  })

  it('an API error on one PR is logged, later PRs still run and CI is still dispatched (#241)', async () => {
    const f = fakeApi({
      prs: [pr(1), pr(2, { draft: true }), pr(3)], verify: { [`${SHA}1`]: green, [`${SHA}2`]: green, [`${SHA}3`]: green },
      fail: (route, p) => (route === COMMENT && p.issue_number === 2 ? 'Resource not accessible by integration' : undefined),
    })
    const res = await run(f, 'schedule')
    expect(res.merged).toEqual([1, 3])
    expect(res.lines).toContain('#2: error: Resource not accessible by integration')
    expect(f.warnings).toEqual(['#2: error — Resource not accessible by integration'])
    expect(f.writes.at(-1)).toMatchObject({
      route: 'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
      params: { workflow_id: 'ci.yml', ref: 'main', inputs: { merged: '#1, #3 (main000)' } },
    })
  })

  it('a dry run writes nothing', async () => {
    const f = fakeApi({ prs: [pr(1), pr(2, { draft: true }), pr(3, { mergeable: false })], verify: { [`${SHA}1`]: green, [`${SHA}2`]: green } })
    const res = await run(f, 'workflow_dispatch', { inputs: { dry_run: 'true' } }, true)
    expect(f.writes).toEqual([])
    expect(res.lines[0]).toBe('#1: [dry run] would merge (abc1234)')
    expect(res.lines[2]).toBe('#3: [dry run] would hand back to Fix: it conflicts with main (abc1234)')
  })
})

describe('automerge.yml', () => {
  const yml = readFileSync(new URL('../.github/workflows/automerge.yml', import.meta.url), 'utf8')
  const mergeIf = yml.slice(yml.indexOf('\n  merge:'), yml.indexOf('concurrency:', yml.indexOf('\n  merge:')))

  it('runs the merge job after every completed CI run, whatever its conclusion (#390)', () => {
    // decide() gates on the head's `verify` alone: a red `portal` must not skip the run.
    expect(yml).toMatch(/workflow_run:\s*\n\s*workflows: \[CI\]\s*\n\s*types: \[completed\]/)
    expect(mergeIf).toMatch(/github\.event_name == 'workflow_run' \|\|/)
    expect(mergeIf).not.toMatch(/conclusion/)
  })
})
