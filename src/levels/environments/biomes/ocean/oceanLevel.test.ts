import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { OCEAN_SEA_ARCH as SHIPPED_ARCH } from './oceanLevel'
import { OCEAN_SEA_ARCH } from './oceanTrack'

// The ride itself is checked with the other generated rides (`rideLevels.test.ts`).
describe('ocean level data', () => {
  it('ships the built sea arch (regenerate with `node scripts/gen-ride-levels.mjs level3`)', () => {
    expect(SHIPPED_ARCH).toEqual(OCEAN_SEA_ARCH)
    expect(shippedLevel('level3').seaArch).toBe(SHIPPED_ARCH)
  })
})
