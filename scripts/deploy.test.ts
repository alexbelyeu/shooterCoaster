import { describe, expect, it } from 'vitest'
import deploy from './deploy.cjs'

const status = (state: string) => ({ state })

describe('isLive', () => {
  it('is live only while a deployment of the commit is the one serving', () => {
    expect(deploy.isLive([[status('success'), status('in_progress')]])).toBe(true)
    expect(deploy.isLive([[status('failure')], [status('success')]])).toBe(true)
  })

  it('redeploys a commit whose deployment was replaced (inactive), failed or never finished', () => {
    expect(deploy.isLive([[status('inactive'), status('success')]])).toBe(false)
    expect(deploy.isLive([[status('error')], [status('pending')]])).toBe(false)
    expect(deploy.isLive([])).toBe(false)
  })
})

describe('reason', () => {
  it('batches merges into the daily deploy while the live site is healthy', () => {
    expect(deploy.reason({ event: 'workflow_run', force: false, deployCheckRed: undefined })).toBeNull()
  })

  it('ships every green main at once while the deploy check is red, so a revert is not held for a day', () => {
    expect(deploy.reason({ event: 'workflow_run', force: false, deployCheckRed: { number: 12 } })).toContain('#12')
  })

  it('deploys on the schedule and when started by hand', () => {
    expect(deploy.reason({ event: 'schedule', force: false })).not.toBeNull()
    expect(deploy.reason({ event: 'workflow_dispatch', force: false })).not.toBeNull()
  })
})
