import { describe, expect, it } from 'vitest'
import {
  MAX_PIERCE, NO_PICKUP, PICKUP_WEAPONS, WEAPONS, activeWeapon, applyPickup, fanAngles, pickupRemaining,
} from './weaponTypes'

describe('weapon table', () => {
  it('rapid halves the fire interval, spread fires 3, piercing hits 3', () => {
    expect(WEAPONS.rapid.fireIntervalMs).toBe(WEAPONS.blaster.fireIntervalMs / 2)
    expect(WEAPONS.spread.spread.count).toBe(3)
    expect(WEAPONS.piercing.pierce).toBe(3)
    expect(MAX_PIERCE).toBe(3)
  })

  it('every pickup lasts 10 s', () => {
    for (const id of PICKUP_WEAPONS) expect(WEAPONS[id].duration).toBe(10)
  })
})

describe('pickup state', () => {
  it('is the blaster with no pickup', () => {
    expect(activeWeapon(NO_PICKUP, 0).id).toBe('blaster')
    expect(pickupRemaining(NO_PICKUP, 0)).toBe(0)
  })

  it('lasts its duration of game time, then falls back to the blaster', () => {
    const s = applyPickup(NO_PICKUP, 'spread', 5)
    expect(activeWeapon(s, 5).id).toBe('spread')
    expect(activeWeapon(s, 14.99).id).toBe('spread')
    expect(pickupRemaining(s, 10)).toBeCloseTo(0.5)
    expect(activeWeapon(s, 15).id).toBe('blaster')
    expect(pickupRemaining(s, 20)).toBe(0)
  })

  it('a new pickup replaces the current one for its full duration', () => {
    const s = applyPickup(applyPickup(NO_PICKUP, 'spread', 0), 'piercing', 8)
    expect(activeWeapon(s, 17).id).toBe('piercing')
    expect(pickupRemaining(s, 8)).toBe(1)
  })
})

describe('fanAngles', () => {
  it('centres the fan on the aim', () => {
    const out: number[] = []
    expect(fanAngles(WEAPONS.blaster, out)).toEqual([0])
    const fan = fanAngles(WEAPONS.spread, out)
    expect(fan).toHaveLength(3)
    expect(fan[1]).toBe(0)
    expect(fan[0]).toBeCloseTo(-fan[2])
    expect(fan[2]).toBeCloseTo((WEAPONS.spread.spread.angleDeg * Math.PI) / 180)
  })
})
