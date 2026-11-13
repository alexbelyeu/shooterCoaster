import { describe, expect, it } from 'vitest'
import { LOGO_OPTIONS, logoFromQuery } from './logoOptions'

describe('logoFromQuery', () => {
  it('picks each concept by name', () => {
    for (const name of LOGO_OPTIONS) expect(logoFromQuery(`?logo=${name}`)).toBe(name)
  })

  it('ignores case and stray spaces, and reads the param among others', () => {
    expect(logoFromQuery('?internal=1&logo=%20Bullseye%20&seed=4')).toBe('bullseye')
  })

  it('falls back to the wordmark without the param or with an unknown name', () => {
    expect(logoFromQuery('')).toBeNull()
    expect(logoFromQuery('?theme=neon')).toBeNull()
    expect(logoFromQuery('?logo=')).toBeNull()
    expect(logoFromQuery('?logo=wordmark')).toBeNull()
    expect(logoFromQuery('?logo=constructor')).toBeNull()
  })
})
