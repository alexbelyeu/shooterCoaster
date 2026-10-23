import { describe, expect, it } from 'vitest'
import {
  analyticsEnabled,
  applyInternalParam,
  dropInternalEvents,
  INTERNAL_STORAGE_KEY,
  isInternalBrowser,
  searchWithoutInternalParam,
  type FlagStorage,
} from './analyticsGate'

function memoryStorage(): FlagStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const throwing: FlagStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('analyticsEnabled', () => {
  it('runs on a Vercel build for real visitors', () => {
    expect(analyticsEnabled(true, '', false)).toBe(true)
    expect(analyticsEnabled(true, '?utm_source=reddit', false)).toBe(true)
  })

  it('is off for e2e test traffic', () => {
    expect(analyticsEnabled(true, '?e2e=1', false)).toBe(false)
    expect(analyticsEnabled(true, '?utm_source=x&e2e', false)).toBe(false)
  })

  it('is off for an internal browser', () => {
    expect(analyticsEnabled(true, '', true)).toBe(false)
  })

  it('is off when not built on Vercel (dev, vite preview, CI)', () => {
    expect(analyticsEnabled(false, '', false)).toBe(false)
  })
})

describe('applyInternalParam', () => {
  it('?internal=1 stores the flag', () => {
    const s = memoryStorage()
    expect(applyInternalParam('?internal=1', s)).toBe(true)
    expect(s.data.get(INTERNAL_STORAGE_KEY)).toBe('1')
    expect(applyInternalParam('', s)).toBe(true)
  })

  it('?internal=0 clears it', () => {
    const s = memoryStorage()
    applyInternalParam('?internal=1', s)
    expect(applyInternalParam('?utm_source=x&internal=0', s)).toBe(false)
    expect(s.data.has(INTERNAL_STORAGE_KEY)).toBe(false)
    expect(applyInternalParam('', s)).toBe(false)
  })

  it('without the parameter reads the stored flag only', () => {
    const s = memoryStorage()
    expect(applyInternalParam('?seed=7', s)).toBe(false)
    expect(s.data.size).toBe(0)
  })

  it('still decides this page load when storage throws or is missing', () => {
    expect(applyInternalParam('?internal=1', throwing)).toBe(true)
    expect(applyInternalParam('?internal=0', throwing)).toBe(false)
    expect(applyInternalParam('', throwing)).toBe(false)
    expect(applyInternalParam('?internal=1', null)).toBe(true)
    expect(applyInternalParam('', null)).toBe(false)
  })
})

describe('isInternalBrowser', () => {
  it('is false when storage throws or is missing', () => {
    expect(isInternalBrowser(throwing)).toBe(false)
    expect(isInternalBrowser(null)).toBe(false)
  })
})

describe('searchWithoutInternalParam', () => {
  it('strips only the internal parameter', () => {
    expect(searchWithoutInternalParam('?internal=1')).toBe('')
    expect(searchWithoutInternalParam('?e2e=1&internal=0&seed=3')).toBe('?e2e=1&seed=3')
  })

  it('is null when there is nothing to strip', () => {
    expect(searchWithoutInternalParam('')).toBeNull()
    expect(searchWithoutInternalParam('?utm_source=x')).toBeNull()
  })
})

describe('dropInternalEvents', () => {
  it('drops page views and events only while the flag is set', () => {
    const s = memoryStorage()
    const beforeSend = dropInternalEvents(s)
    const event = { type: 'event' as const, url: 'https://scoaster.com/' }
    expect(beforeSend(event)).toBe(event)
    applyInternalParam('?internal=1', s)
    expect(beforeSend(event)).toBeNull()
    expect(beforeSend({ type: 'pageview' as const, url: 'https://scoaster.com/' })).toBeNull()
  })

  it('lets events through when storage throws', () => {
    const event = { type: 'pageview' as const, url: 'https://scoaster.com/' }
    expect(dropInternalEvents(throwing)(event)).toBe(event)
  })
})
