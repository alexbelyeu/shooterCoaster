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
