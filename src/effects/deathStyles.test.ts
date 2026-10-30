import { describe, it, expect } from 'vitest'
import { getAllLevels } from '@/levels/LevelRegistry'
import {
  BOSS_PART_DEATH_STYLE,
  CHUNKS_PER_SLOT,
  DEATH_STYLES,
  GLOW_PER_SLOT,
  HOLD_LIFE,
  nextAge,
  particleOffset,
  sizeAt,
  styleCounts,
  type DeathStyle,
} from './deathStyles'

const ALL: [string, DeathStyle][] = [
  ...Object.entries(DEATH_STYLES),
  ['bossPart', BOSS_PART_DEATH_STYLE],
]

describe('death styles', () => {
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
