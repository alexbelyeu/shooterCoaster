import { describe, expect, it } from 'vitest'
import { gateProblems } from './lighthouseGate.mjs'

const scores = (seo: number, accessibility: number, bp: number, performance = 10) => ({
  scores: { seo, accessibility, 'best-practices': bp, performance },
})

describe('gateProblems', () => {
  it('passes SEO 100 and 95+ elsewhere, whatever Performance scores', () => {
    expect(gateProblems({ mobile: scores(100, 95, 100, 3), desktop: scores(100, 100, 95) })).toEqual([])
  })

  it('fails SEO under 100 and Accessibility or Best Practices under 95, per form factor', () => {
    expect(gateProblems({ mobile: scores(92, 94, 100), desktop: scores(100, 100, 90) })).toEqual([
      'mobile seo 92 < 100',
      'mobile accessibility 94 < 95',
      'desktop best-practices 90 < 95',
    ])
  })

  it('fails a missing category', () => {
    expect(gateProblems({ mobile: { scores: { seo: 100 } } })).toHaveLength(2)
  })
})
