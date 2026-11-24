import { describe, expect, it } from 'vitest'
import { canInstall, captureInstallPrompt, onInstallChange, promptInstall } from './installPrompt'

function offer() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<unknown>; prompted: number }
  event.prompted = 0
  event.prompt = () => {
    event.prompted++
    return Promise.resolve()
  }
  return event
}

describe('installPrompt', () => {
  it('holds the browser offer, prompts it once, and drops it when the game is installed', () => {
    const page = new EventTarget()
    captureInstallPrompt(page)
    let changes = 0
    const off = onInstallChange(() => changes++)
    expect(canInstall()).toBe(false)

    const first = offer()
    page.dispatchEvent(first)
    expect(first.defaultPrevented).toBe(true)
    expect(canInstall()).toBe(true)
    promptInstall()
    promptInstall()
    expect(first.prompted).toBe(1)
    expect(canInstall()).toBe(false)

    page.dispatchEvent(offer())
    expect(canInstall()).toBe(true)
    page.dispatchEvent(new Event('appinstalled'))
    expect(canInstall()).toBe(false)
    expect(changes).toBe(4)
    off()
  })
})
