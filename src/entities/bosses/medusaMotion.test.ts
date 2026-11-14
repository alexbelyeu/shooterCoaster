import { describe, expect, it } from 'vitest'
import { bossMaxScore, maxHp } from './bossModel'
import { MEDUSA } from './bossSpecs'
import {
  MEDUSA_BODY, MEDUSA_DEFEAT, MEDUSA_RISE, SNAKE, SNAKE_SLOTS, bodyPlacement, defeatSink, laughShake, laySnake, riseAmount,
  snakeLength, strikeLandsBetween, strikePose,
} from './medusaMotion'

const N = SNAKE.segments
const pts = new Float32Array((N + 1) * 3)
const FORWARD = [0, 0, 1] as const
const head = () => [pts[N * 3], pts[N * 3 + 1], pts[N * 3 + 2]]
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('Medusa spec', () => {
  it('four snakes, four more, then the crown snake; 900 points; a 20 hp fight', () => {
    expect(MEDUSA.weakPoints.map((w) => w.phase)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2])
    expect(MEDUSA.weakPoints[MEDUSA.weakPoints.length - 1].id).toBe('crown')
    expect(MEDUSA.weakPoints.length).toBe(SNAKE_SLOTS.length)
    expect(bossMaxScore(MEDUSA)).toBe(900)
    // 2 hits a second (the smoke's rate) plus her rise and each phase uncoiling stay well inside the 20 s fight.
    const seconds = maxHp(MEDUSA) / 2 + MEDUSA_RISE.riseS + 2 * SNAKE.emergeS
    expect(seconds).toBeLessThan(15)
  })
})

describe('her rise, lean and defeat', () => {
  it('rises out of the hub small and lands out in front of the star at full size', () => {
    const p = { y: 0, z: 0, scale: 0, pitch: 0 }
    bodyPlacement(0, 0, -1, p)
    expect(p).toMatchObject({ y: MEDUSA_RISE.from[1], z: MEDUSA_RISE.from[2], scale: MEDUSA_RISE.fromScale })
    bodyPlacement(MEDUSA_RISE.riseS, 0, -1, p)
    expect(p).toMatchObject({ y: 0, z: MEDUSA_BODY.out, scale: 1, pitch: 0 })
    bodyPlacement(10, 1, -1, p)
    expect(p.z).toBe(MEDUSA_BODY.out + MEDUSA_RISE.leanOut)
    expect(p.pitch).toBeCloseTo(MEDUSA_RISE.leanPitch)
    expect(riseAmount(MEDUSA_RISE.riseS / 2)).toBeCloseTo(0.5)
  })

  it('laughs (head back, shaking), then sinks back into the hub', () => {
    const p = { y: 0, z: 0, scale: 0, pitch: 0 }
    bodyPlacement(10, 1, 0.5, p)
    expect(p.pitch).toBeLessThan(0)
    expect(Math.abs(laughShake(0.05))).toBeGreaterThan(0)
    expect(laughShake(MEDUSA_DEFEAT.laughS + 0.1)).toBe(0)
    expect(laughShake(-1)).toBe(0)
    expect(defeatSink(MEDUSA_DEFEAT.laughS)).toBe(0)
    bodyPlacement(10, 1, MEDUSA_DEFEAT.laughS + MEDUSA_DEFEAT.sinkS, p)
    expect(p).toMatchObject({ y: MEDUSA_RISE.from[1], z: MEDUSA_RISE.from[2], scale: MEDUSA_RISE.fromScale })
  })
})

describe('snakes', () => {
  it('strike once a period, landing at full reach, rearing back first', () => {
    for (const s of SNAKE_SLOTS) {
      let lands = 0
      let min = 0
      for (let t = 0; t < 20; t += 0.01) {
        const pose = strikePose(s, t)
        min = Math.min(min, pose)
        expect(pose).toBeLessThanOrEqual(1)
        if (strikeLandsBetween(s, t, t + 0.01)) {
          lands++
          expect(strikePose(s, t + 0.01)).toBeGreaterThan(0.95)
        }
      }
      expect(lands).toBeGreaterThanOrEqual(Math.floor(20 / s.period))
      expect(lands).toBeLessThanOrEqual(Math.ceil(20 / s.period))
      expect(min).toBeCloseTo(-SNAKE.windup)
    }
  })

  it('take turns: no two snakes of a phase land within 0.3 s of each other', () => {
    for (const phase of [0, 1]) {
      const slots = SNAKE_SLOTS.filter((s) => s.phase === phase)
      const landsAt = slots.map((s) => (((SNAKE.holdAt * s.period - s.offset) % s.period) + s.period) % s.period).sort((a, b) => a - b)
      const gaps = landsAt.map((t, i) => (i === 0 ? landsAt[0] + slots[0].period - landsAt[landsAt.length - 1] : t - landsAt[i - 1]))
      expect(Math.min(...gaps)).toBeGreaterThan(0.3)
    }
  })

  it('grow from their root in the curls, coiled away until their phase, a stub once shot', () => {
    const s = SNAKE_SLOTS[0]
    expect(snakeLength(s, null, 5, true)).toBe(0)
    expect(snakeLength(s, 1, 1 + SNAKE.emergeS, true)).toBe(1)
    expect(snakeLength(s, 1, 9, false)).toBe(SNAKE.stub)
    laySnake(s, 0, 0, true, FORWARD, pts)
    for (let k = 0; k <= N; k++) expect(dist([pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]], s.root)).toBeCloseTo(0)
    laySnake(s, 0, 1, true, FORWARD, pts)
    expect([pts[0], pts[1], pts[2]]).toEqual([...s.root])
    expect(dist(head(), s.root)).toBeGreaterThan(s.length * 0.6)
  })

  it('at rest every head is out beyond her curls and clear of her face', () => {
    for (const s of SNAKE_SLOTS) {
      for (let t = 0; t < s.period; t += 0.05) {
        if (strikePose(s, t) !== 0) continue
        laySnake(s, t, 1, true, FORWARD, pts)
        const h = head()
        expect(dist(h, MEDUSA_BODY.head)).toBeGreaterThan(110)
        const onFace = Math.abs(h[0]) < 50 && h[1] > -30 && h[1] < 90 && h[2] > 30
        expect(onFace).toBe(false)
      }
    }
  })

  it('strike along the way to the camera', () => {
    const s = SNAKE_SLOTS[2]
    const t = SNAKE.holdAt * s.period - s.offset + s.period
    laySnake(s, t - (SNAKE.holdAt - SNAKE.windupAt) * s.period + 0.01, 1, true, FORWARD, pts)
    const rest = head()
    laySnake(s, t, 1, true, FORWARD, pts)
    const struck = head()
    expect(struck[2] - rest[2]).toBeGreaterThan(s.length)
  })
})
