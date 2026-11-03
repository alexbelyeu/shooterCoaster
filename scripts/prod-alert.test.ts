import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import alert from './prod-alert.cjs'

const prodCheck = (checks: { id: string; ok: boolean; problems?: string[] }[], running?: string) => ({ checks, running })

describe('decide', () => {
  it('alerts only on green → red and closes on red → green', () => {
    expect(alert.decide(true, undefined)).toBe('open')
    expect(alert.decide(true, { number: 1 })).toBe('none')
    expect(alert.decide(false, { number: 1 })).toBe('close')
    expect(alert.decide(false, undefined)).toBe('none')
  })

  it('owns only the issue with its own marker (not CI\'s red main, not the other suite\'s)', () => {
    const issues = [
      { number: 1, body: 'CI `verify` failed on main' },
      { number: 2, body: `x\n${alert.marker('nightly')}` },
      { number: 3, body: `y\n${alert.marker('deploy')}` },
    ]
    expect(alert.ownIssue(issues, 'deploy')?.number).toBe(3)
    expect(alert.ownIssue(issues, 'nightly')?.number).toBe(2)
    expect(alert.ownIssue(issues.slice(0, 1), 'deploy')).toBeUndefined()
  })
})

describe('whatHappened', () => {
  it('names the failed check and its problems', () => {
    const results = prodCheck([{ id: 'title', ok: true }, { id: 'assets', ok: false, problems: ['/assets/tone-x.js: HTTP 404 (want 200)'] }])
    const text = alert.whatHappened({ exitCode: 1, capMinutes: 8, results })
    expect(text).toBe('Check failed:\n- **assets**: /assets/tone-x.js: HTTP 404 (want 200)')
  })

  it('says a timeout with no failed check is just that, and where it was', () => {
    const results = prodCheck([{ id: 'assets', ok: true }], 'phone')
    expect(alert.whatHappened({ exitCode: 124, capMinutes: 8, results })).toBe('Timed out after 8 min while running **phone**, no check failed.')
    expect(alert.whatHappened({ exitCode: 137, capMinutes: 60, results: [] })).toBe('Timed out after 60 min, no check failed.')
    expect(alert.whatHappened({ exitCode: 124, capMinutes: 60, results: null })).toBe('Timed out after 60 min before the suite reported any result.')
  })

  it('reads the full smoke\'s results.json array and caps long problem lists', () => {
    const results = [{ id: 'level2', ok: false, problems: ['a', 'b', 'c', 'd', 'e'] }, { id: 'level3', ok: true, problems: [] }]
    expect(alert.whatHappened({ exitCode: 1, capMinutes: 60, results })).toBe('Check failed:\n- **level2**: a; b; c (+2 more)')
  })

  it('tells a crash from a failed check', () => {
    expect(alert.whatHappened({ exitCode: 1, capMinutes: 8, results: null })).toMatch(/^Exited with code 1 before any check failed/)
  })
})

function fakeGitHub() {
  const issues: { number: number; title: string; body: string; state: string; labels: string[] }[] = []
  const comments: { issue: number; body: string }[] = []
  const github = {
    paginate: async (fn: (p: object) => Promise<{ data: unknown[] }>, params: object) => (await fn(params)).data,
    rest: {
      issues: {
        listForRepo: async ({ labels }: { labels: string }) => ({
          data: issues.filter((i) => i.state === 'open' && i.labels.includes(labels)),
        }),
        create: async ({ title, body, labels }: { title: string; body: string; labels: string[] }) => {
          const issue = { number: 100 + issues.length, title, body, labels, state: 'open' }
          issues.push(issue)
          return { data: issue }
        },
        createComment: async ({ issue_number, body }: { issue_number: number; body: string }) => {
          comments.push({ issue: issue_number, body })
        },
        update: async ({ issue_number, state }: { issue_number: number; state: string }) => {
          issues.find((i) => i.number === issue_number)!.state = state
        },
      },
    },
  }
  return { github, issues, comments }
}

describe('a run sequence against GitHub', () => {
  const summary = { addHeading: () => summary, addRaw: () => summary, write: async () => {} }
  const core = { info: () => {}, summary }
  const context = (runId: number) => ({
    repo: { owner: 'alexbelyeu', repo: 'shootercoaster' },
    serverUrl: 'https://github.com',
    runId,
    sha: 'abcdef1234567',
    eventName: 'deployment_status',
  })

  it('a broken check opens exactly one issue naming it, a second red run stays quiet, and green closes it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-alert-'))
    const write = (results: object) => fs.writeFileSync(path.join(dir, 'prod-check.json'), JSON.stringify(results))
    const env = (exitCode: number) => ({ SUITE: 'deploy', EXIT_CODE: String(exitCode), CAP_MINUTES: '8', RESULTS_DIR: dir })
    const { github, issues, comments } = fakeGitHub()
    issues.push({ number: 7, title: 'CI verify failed on main @ 1234567', body: 'CI `verify` failed', state: 'open', labels: ['agent:prod-broken'] })

    write(prodCheck([{ id: 'routes', ok: false, problems: ['/nope: HTTP 200 (want 404)'] }]))
    await alert({ github, context: context(1), core, env: env(1) })
    await alert({ github, context: context(2), core, env: env(1) })
    const opened = issues.filter((i) => i.title === 'Production deploy check failing')
    expect(opened).toHaveLength(1)
    expect(opened[0].body).toContain('**routes**: /nope: HTTP 200 (want 404)')
    expect(opened[0].labels).toEqual(['agent:prod-broken', 'P1', 'type:bug'])
    expect(comments).toHaveLength(0)

    write(prodCheck([{ id: 'routes', ok: true }]))
    await alert({ github, context: context(3), core, env: env(0) })
    expect(opened[0].state).toBe('closed')
    expect(comments).toEqual([{ issue: opened[0].number, body: expect.stringContaining('green again') }])
    expect(issues.find((i) => i.number === 7)!.state).toBe('open')

    await alert({ github, context: context(4), core, env: env(0) })
    expect(comments).toHaveLength(1)
  })
})
