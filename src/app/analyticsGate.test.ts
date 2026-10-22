import { describe, expect, it } from 'vitest'
import { analyticsEnabled } from './analyticsGate'

describe('analyticsEnabled', () => {
  it('runs on a Vercel build for real visitors', () => {
    expect(analyticsEnabled(true, '')).toBe(true)
    expect(analyticsEnabled(true, '?utm_source=reddit')).toBe(true)
  })

  it('is off for e2e test traffic', () => {
    expect(analyticsEnabled(true, '?e2e=1')).toBe(false)
    expect(analyticsEnabled(true, '?utm_source=x&e2e')).toBe(false)
  })

  it('is off when not built on Vercel (dev, vite preview, CI)', () => {
    expect(analyticsEnabled(false, '')).toBe(false)
  })
})
