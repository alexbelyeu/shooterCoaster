import { describe, it, expect } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import {
  BOSS_DEFEAT_BURST_OFFSETS,
  BOSS_DEFEAT_DEATH_STYLE,
  BOSS_PART_DEATH_STYLE,
  DEATH_SLOTS,
  GOLDEN_BALLOON_DEATH_STYLE,
  CHUNKS_PER_SLOT,
  DEATH_STYLES,
  GLOW_PER_SLOT,
  HOLD_LIFE,
  KRAKEN_SPLASH_DEATH_STYLE,
  WHALE_SPLASH_DEATH_STYLE,
  SAND_BURST_DEATH_STYLE,
  SNOW_BURST_DEATH_STYLE,
  SNOWBALL_DEATH_STYLE,
  YETI_PART_DEATH_STYLE,
  SCORPION_SHARD_DEATH_STYLE,
  TITAN_PART_DEATH_STYLE,
  TITAN_BREAK_DEATH_STYLE,
  LAVA_BURST_DEATH_STYLE,
  MEDUSA_SNAKE_DEATH_STYLE,
  MEDUSA_CHALK_BURST_DEATH_STYLE,
  nextAge,
  particleOffset,
  pickDeathSlot,
  sizeAt,
  styleCounts,
  type DeathStyle,
} from './deathStyles'
import { MEDUSA_DEFEAT_BURST_YS } from '@/entities/bosses/medusaMotion'
import { TITAN_BREAK_POINTS } from '@/entities/bosses/titanMotion.hot'

const ALL: [string, DeathStyle][] = [
  ...Object.entries(DEATH_STYLES),
  ['bossPart', BOSS_PART_DEATH_STYLE],
  ['bossDefeat', BOSS_DEFEAT_DEATH_STYLE],
  ['goldenBalloon', GOLDEN_BALLOON_DEATH_STYLE],
  ['krakenSplash', KRAKEN_SPLASH_DEATH_STYLE],
  ['whaleSplash', WHALE_SPLASH_DEATH_STYLE],
  ['scorpionShard', SCORPION_SHARD_DEATH_STYLE],
  ['sandBurst', SAND_BURST_DEATH_STYLE],
  ['yetiPart', YETI_PART_DEATH_STYLE],
  ['snowBurst', SNOW_BURST_DEATH_STYLE],
  ['snowball', SNOWBALL_DEATH_STYLE],
  ['titanPart', TITAN_PART_DEATH_STYLE],
  ['titanBreak', TITAN_BREAK_DEATH_STYLE],
  ['lavaBurst', LAVA_BURST_DEATH_STYLE],
  ['medusaSnake', MEDUSA_SNAKE_DEATH_STYLE],
  ['medusaChalkBurst', MEDUSA_CHALK_BURST_DEATH_STYLE],
]

describe('death styles', () => {
  it("every boss's defeat fits the pool with a slot to spare: its last part, the confetti and its own bursts", () => {
    // The confetti lives 3.2 s and every boss's own defeat bursts fire within it, so all of these overlap.
    const ownDefeatBursts = { magmaTitan: TITAN_BREAK_POINTS.length, medusa: MEDUSA_DEFEAT_BURST_YS.length, other: 0 }
    for (const own of Object.values(ownDefeatBursts)) {
      expect(1 + BOSS_DEFEAT_BURST_OFFSETS.length + own + 1).toBeLessThanOrEqual(DEATH_SLOTS)
    }
    expect(styleCounts(BOSS_DEFEAT_DEATH_STYLE).glow * BOSS_DEFEAT_BURST_OFFSETS.length).toBeGreaterThanOrEqual(180)
  })

  it('a golden balloon pops in gold: every confetti piece is a warm yellow, unlike a plain balloon', () => {
    const confetti = GOLDEN_BALLOON_DEATH_STYLE.layers.find((l) => l.shape === 'confetti')!
    for (const c of confetti.colors) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      expect(r, c).toBeGreaterThan(200)
      expect(g, c).toBeGreaterThan(140)
      expect(b, c).toBeLessThan(g)
    }
    expect(GOLDEN_BALLOON_DEATH_STYLE.sound).toBe(DEATH_STYLES.balloon.sound)
  })

  it.each(ALL)('%s fits one pool slot and is well formed', (_, style) => {
    const { glow, chunks } = styleCounts(style)
    expect(glow).toBeLessThanOrEqual(GLOW_PER_SLOT)
    expect(chunks).toBeLessThanOrEqual(CHUNKS_PER_SLOT)
    expect(glow + chunks).toBeGreaterThan(0)
    expect(style.lifetime).toBeGreaterThan(0)
    expect(style.scale).toBeGreaterThan(0)
    for (const l of style.layers) {
      expect(l.count).toBeGreaterThan(0)
      expect(l.colors.length).toBeGreaterThan(0)
      for (const c of l.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      expect(l.speed[0]).toBeLessThanOrEqual(l.speed[1])
      expect(l.hold).toBeGreaterThanOrEqual(0)
      expect(l.hold).toBeLessThan(1)
      expect(l.size).toBeGreaterThan(0)
    }
  })

  it('the enemy types of each level all look different', () => {
    for (const level of getAllLevels()) {
      const types = [...new Set(level.enemies.map((w) => w.type))]
      const shapes = types.map((t) => DEATH_STYLES[t].layers.map((l) => `${l.shape}:${l.colors.join()}`).join('|'))
      expect(new Set(shapes).size, level.id).toBe(types.length)
    }
  })

  it('golems and drakes throw 3–5 tumbling chunks', () => {
    for (const t of ['lavaGolem', 'infernalDrake'] as const) {
      const { chunks } = styleCounts(DEATH_STYLES[t])
      expect(chunks).toBeGreaterThanOrEqual(3)
      expect(chunks).toBeLessThanOrEqual(5)
      expect(DEATH_STYLES[t].layers.find((l) => l.shape === 'chunk')!.gravity).toBeGreaterThan(0)
    }
  })
})

describe('particle kinematics', () => {
  const v = { x: 10, y: 20, z: -5 }
  const out = { x: 0, y: 0, z: 0 }

  it('without drag or gravity moves at the launch velocity', () => {
    particleOffset(out, v, 0, 0, 2)
    expect(out).toEqual({ x: 20, y: 40, z: -10 })
  })

  it('drag caps the travel at v / drag', () => {
    particleOffset(out, v, 2, 0, 100)
    expect(out.x).toBeCloseTo(5)
    expect(out.y).toBeCloseTo(10)
  })

  it('gravity pulls down, negative gravity floats up', () => {
    particleOffset(out, { x: 0, y: 0, z: 0 }, 1, 10, 2)
    expect(out.y).toBeCloseTo(-20)
    particleOffset(out, { x: 0, y: 0, z: 0 }, 1, -10, 2)
    expect(out.y).toBeCloseTo(20)
  })

  it('size holds, then shrinks to 0 at the end of life', () => {
    expect(sizeAt(0, 0)).toBe(1)
    expect(sizeAt(0.5, 0.6)).toBe(1)
    expect(sizeAt(0.8, 0.6)).toBeCloseTo(0.5)
    expect(sizeAt(1, 0.6)).toBe(0)
    expect(sizeAt(0.5, 0)).toBeCloseTo(0.5)
  })
})

describe('nextAge', () => {
  it('advances by game time', () => {
    expect(nextAge(0.2, 0.1, 1.5, false)).toBeCloseTo(0.3)
    expect(nextAge(0.2, 0, 1.5, false)).toBe(0.2)
  })

  it('stops at HOLD_LIFE while held, and never rewinds', () => {
    const holdAt = 2 * HOLD_LIFE
    expect(nextAge(0, 1, 2, true)).toBeCloseTo(holdAt)
    expect(nextAge(holdAt, 1, 2, true)).toBeCloseTo(holdAt)
    expect(nextAge(1.5, 1, 2, true)).toBe(1.5)
    expect(holdAt).toBeLessThan(2)
  })
})

describe('pickDeathSlot', () => {
  const idle = (serial: number) => ({ active: false, needsZero: false, serial })

  it('takes the first idle slot, clean', () => {
    expect(pickDeathSlot([{ active: true, needsZero: false, serial: 1 }, idle(0), idle(0)])).toEqual({ index: 1, clear: false })
  })

  it('clears a slot that expired this frame and is not zeroed yet (#228)', () => {
    const slots = [{ active: true, needsZero: false, serial: 2 }, { active: false, needsZero: true, serial: 1 }]
    expect(pickDeathSlot(slots)).toEqual({ index: 1, clear: true })
  })

  it('steals the oldest active slot when full, and clears it', () => {
    const slots = [3, 1, 2].map((serial) => ({ active: true, needsZero: false, serial }))
    expect(pickDeathSlot(slots)).toEqual({ index: 1, clear: true })
  })
})
