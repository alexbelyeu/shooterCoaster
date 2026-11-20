import { describe, expect, it } from 'vitest'
import { RESULTS_CUTS, resultsCut } from './resultsCut'
import { SCORES } from './index'

describe('results cut (#792)', () => {
  it('plays the lose cut for 0 or 1 star and the win cut for 2 or 3', () => {
    expect([0, 1, 2, 3].map(resultsCut)).toEqual(['results-lose', 'results-lose', 'results-win', 'results-win'])
  })

  it('every cut has a score', () => {
    for (const id of RESULTS_CUTS) expect(SCORES[id]).toBeDefined()
  })
})
