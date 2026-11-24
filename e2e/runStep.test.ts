import { describe, expect, it, vi } from 'vitest'
import { runStep } from './runStep.mjs'

function fakeBrowser() {
  const contexts: { close: () => Promise<void>; closed: boolean }[] = []
  const open = () => {
    const c = { closed: false, close: async () => { c.closed = true; contexts.splice(contexts.indexOf(c), 1) } }
    contexts.push(c)
    return c
  }
  return { contexts: () => [...contexts], open }
}

describe('runStep', () => {
  it('passes a step result through and times it', async () => {
    const browser = fakeBrowser()
    const r = await runStep(async () => ({ id: 'daily', ok: true, problems: [] }), { id: 'daily', browser })
    expect(r).toMatchObject({ id: 'daily', ok: true, problems: [] })
    expect(r.seconds).toBeGreaterThanOrEqual(0)
  })

  it('turns a throw into a failed check named for the step and closes only the contexts the step opened (#707)', async () => {
    const browser = fakeBrowser()
    const kept = browser.open()
    let opened: ReturnType<typeof browser.open> | null = null
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await runStep(async () => {
      opened = browser.open()
      throw new Error('page.goto: net::ERR_CONNECTION_RESET at https://scoaster.com/?e2e=1\nCall log: …')
    }, { id: 'boss', level: 'level6', browser })
    error.mockRestore()
    expect(r).toMatchObject({
      id: 'boss', level: 'level6', ok: false, threw: true, errors: [],
      problems: ['threw: page.goto: net::ERR_CONNECTION_RESET at https://scoaster.com/?e2e=1'],
    })
    expect(opened!.closed).toBe(true)
    expect(kept.closed).toBe(false)
  })
})
