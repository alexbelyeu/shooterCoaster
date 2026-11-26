import { describe, expect, it } from 'vitest'
import { BOSS_WIN_HOLD_SECONDS, FOLLOWS_RIDER, bossWinEndsAt, nothingLeft, outOfReach, runReach, type RunReach } from './bossWin'
import type { ArcTable } from '@/track/arcLength'
import { rideSpeeds } from '@/track/ridePhysics'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Vec3 } from '@/utils/vec3'
import { RUN_SECONDS } from './pacing'

describe('nothingLeft', () => {
  it('is true once the boss is beaten with no enemy, golden balloon or wave left', () => {
    expect(nothingLeft(true, 0, 0, null)).toBe(true)
  })

  it('waits for the boss', () => {
    expect(nothingLeft(false, 0, 0, null)).toBe(false)
  })

  it('goes on while an enemy is left to kill', () => {
    expect(nothingLeft(true, 1, 0, null)).toBe(false)
  })

  it('goes on while a golden balloon is still up', () => {
    expect(nothingLeft(true, 0, 1, null)).toBe(false)
  })

  it('goes on while a wave is still to come, even one already past due', () => {
    expect(nothingLeft(true, 0, 0, 52)).toBe(false)
    expect(nothingLeft(true, 0, 0, 30)).toBe(false)
  })
})

describe('bossWinEndsAt', () => {
  it('ends the run after the hold', () => {
    expect(bossWinEndsAt(48)).toBe(48 + BOSS_WIN_HOLD_SECONDS)
  })

  it('leaves a clear in the last seconds to the timer', () => {
    expect(bossWinEndsAt(RUN_SECONDS - BOSS_WIN_HOLD_SECONDS)).toBeNull()
    expect(bossWinEndsAt(RUN_SECONDS - 1)).toBeNull()
    expect(bossWinEndsAt(RUN_SECONDS - BOSS_WIN_HOLD_SECONDS - 0.1)).toBeCloseTo(RUN_SECONDS - 0.1)
  })

  it('takes the run length', () => {
    expect(bossWinEndsAt(25, 30)).toBe(28)
    expect(bossWinEndsAt(28, 30)).toBeNull()
  })
})

/** A closed loop out along +x to 10 000 and back along z = 500, parameterised by arc length (perimeter 21 000). */
function loopTable(): ArcTable {
  const corners = [[0, 0], [10000, 0], [10000, 500], [0, 500], [0, 0]]
  const length = 21000
  const count = 4201
  const table: ArcTable = {
    count, length, t: new Float64Array(count), s: new Float64Array(count),
    x: new Float64Array(count), y: new Float64Array(count), z: new Float64Array(count),
  }
  for (let i = 0; i < count; i++) {
    let d = (length * i) / (count - 1)
    table.t[i] = i / (count - 1)
    table.s[i] = d
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c]
      const [bx, bz] = corners[c + 1]
      const side = Math.hypot(bx - ax, bz - az)
      if (d <= side || c === 3) {
        table.x[i] = ax + ((bx - ax) * d) / side
        table.z[i] = az + ((bz - az) * d) / side
        break
      }
      d -= side
    }
  }
  return table
}

/** The run's ride at a steady `speed` units a second. */
function reachAt(speed: number): RunReach {
  const reach = runReach(loopTable(), rideSpeeds({ rollerSpeed: 0.001, minRollerSpeed: 0.001 }))
  for (let k = 0; k < reach.profile.length; k++) reach.profile[k] = (speed * k) / 10
  return reach
}

describe('outOfReach', () => {
  const range = 2000
  const flat = () => -100
  /** An enemy with no height, the eye on the rails, over flat ground below the track. */
  const out = (p: Vec3, reach: RunReach, t: number, levelTime: number, within: number, ground: HeightFunction = flat) =>
    outOfReach(p, 0, reach, ground, 0, t, levelTime, within)
  // The rider halfway out (t = 5000 / 21 000) at 50 s, at (5000, 0, 0) heading +x.
  const t = 5000 / 21000

  it('counts an enemy left behind the rider as out of reach', () => {
    expect(out({ x: 1000, y: 0, z: -3000 }, reachAt(100), t, 50, range)).toBe(true)
  })

  it('keeps an enemy behind the rider that a later U-turn of the track rides back within range of', () => {
    // 10 s at 1 600 a second: out to the end, across and back past x = 1000 on z = 500.
    expect(out({ x: 1000, y: 0, z: -1000 }, reachAt(1600), t, 50, range)).toBe(false)
    expect(out({ x: 1000, y: 0, z: -1000 }, reachAt(100), t, 50, range)).toBe(true)
  })

  it('wraps round the loop when the run rides past the seam', () => {
    // Near the end of the return leg, the ride crosses the seam and out along +x again.
    const late = 20000 / 21000
    expect(out({ x: 3000, y: 0, z: -1500 }, reachAt(400), late, 50, range)).toBe(false)
    expect(out({ x: 6000, y: 0, z: -1500 }, reachAt(400), late, 50, range)).toBe(true)
  })

  it('counts an enemy behind a hill from every point of the rest of the ride as out of reach', () => {
    const p = { x: 8000, y: 0, z: -1800 }
    // A ridge along z = -900 under x 6000..9500, higher than the line of sight.
    const ridge: HeightFunction = (x, z) => (Math.abs(z + 900) < 100 && x > 6000 && x < 9500 ? 200 : -100)
    expect(out(p, reachAt(400), t, 50, range, ridge)).toBe(true)
    expect(out(p, reachAt(400), t, 50, range)).toBe(false)
  })

  it('counts a speck off the rest of the track as out of reach', () => {
    expect(out({ x: 8000, y: 0, z: -6000 }, reachAt(400), t, 50, range)).toBe(true)
  })

  it('keeps a speck ahead that the rest of the ride comes within range of', () => {
    expect(out({ x: 8000, y: 0, z: -1800 }, reachAt(400), t, 50, range)).toBe(false)
  })

  it('never counts an enemy within range and in view of the rider now, only one overhead or behind', () => {
    expect(out({ x: 5500, y: 1000, z: 0 }, reachAt(0), t, 60, range)).toBe(false)
    expect(out({ x: 5000, y: 1900, z: 0 }, reachAt(0), t, 60, range)).toBe(true)
    expect(out({ x: 6500, y: 0, z: 500 }, reachAt(0), t, 60, range)).toBe(false)
  })

  it('counts an enemy close behind the seat, which the view never turns back to, as out of reach', () => {
    expect(out({ x: 4000, y: 0, z: -300 }, reachAt(100), t, 50, range)).toBe(true)
  })

  it('keeps an enemy behind the seat on a stretch the seat rides backwards', () => {
    const reach = reachAt(100)
    const back = runReach({ ...reach.table, backwards: [{ from: 4500, to: 6000 }] }, rideSpeeds({ rollerSpeed: 0.001, minRollerSpeed: 0.001 }))
    expect(out({ x: 4000, y: 0, z: -300 }, { ...back, profile: reach.profile }, t, 50, range)).toBe(false)
  })

  it('never counts a follower: crows and toucans fly back to the rider', () => {
    expect(FOLLOWS_RIDER.has('crow')).toBe(true)
    expect(FOLLOWS_RIDER.has('toucan')).toBe(true)
    expect(FOLLOWS_RIDER.has('snowman')).toBe(false)
  })
})
