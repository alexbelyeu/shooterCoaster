import { describe, expect, it } from 'vitest'
import { addMedals, sanitizeSavedMedals } from './savedMedals'

describe('saved medals (#879)', () => {
  it('keeps medals once won, each once', () => {
    expect(addMedals(['hotStreak'], ['goldRush'])).toEqual(['hotStreak', 'goldRush'])
    expect(addMedals(undefined, ['goldRush', 'goldRush'])).toEqual(['goldRush'])
    expect(addMedals(['deadEye'], [])).toEqual(['deadEye'])
  })

  it('loads stored medals as valid data or nothing', () => {
    expect(sanitizeSavedMedals(null)).toEqual({})
    expect(sanitizeSavedMedals('x')).toEqual({})
    expect(sanitizeSavedMedals([['goldRush']])).toEqual({})
    expect(sanitizeSavedMedals({ level1: ['goldRush', 7, 'goldRush'], level2: 'deadEye', level3: [] })).toEqual({ level1: ['goldRush'] })
  })
})
