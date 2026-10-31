import { describe, expect, it } from 'vitest'
import {
  ARCADE_SOUNDS, KILL_TIMBRES, PRIO, VOICE_BUDGET, bossHitRate, hitRate, keyNote, killRate, nextBeat, pickVoice, spatial,
  type ArcadeSoundId, type VoiceState,
} from '../sfxDesign'
import { RECIPES } from './recipes'
import { foldLoop, normalise, trimTail } from './bake'

const voice = (prio: number, startedAt: number, endsAt: number): VoiceState => ({ prio, startedAt, endsAt })

describe('pickVoice', () => {
  it('takes a free voice first', () => {
    expect(pickVoice([voice(6, 0, 5), voice(1, 0, 0.5), voice(1, 0, 5)], 1, 1)).toBe(1)
  })

  it('steals the lowest priority, then the oldest', () => {
    const busy = [voice(3, 0.2, 9), voice(1, 0.5, 9), voice(1, 0.3, 9), voice(6, 0, 9)]
    expect(pickVoice(busy, 3, 1)).toBe(2)
    expect(pickVoice(busy, 1, 1)).toBe(2)
  })

  it('never steals a higher priority: a gunshot is dropped while only kills and cues play', () => {
    const busy = [voice(PRIO.kill, 0, 9), voice(PRIO.event, 0, 9)]
    expect(pickVoice(busy, PRIO.fire, 1)).toBe(-1)
    expect(pickVoice(busy, PRIO.event, 1)).toBe(0)
  })

  it('keeps any burst inside the budget, kills winning the pool', () => {
    const pool = Array.from({ length: VOICE_BUDGET }, () => voice(0, 0, 0))
    let dropped = 0
    for (let i = 0; i < 64 * 6; i++) {
      const prio = [PRIO.fire, PRIO.hit, PRIO.kill][i % 3]
      const now = i * 0.001
      const v = pickVoice(pool, prio, now)
      if (v < 0) dropped++
      else pool[v] = voice(prio, now, now + 1)
    }
    expect(pool).toHaveLength(VOICE_BUDGET)
    expect(dropped).toBeGreaterThan(0)
    expect(pool.filter((v) => v.prio === PRIO.kill)).toHaveLength(VOICE_BUDGET)
  })
})

describe('keyNote', () => {
  it('walks the major and minor scales, across octaves', () => {
    const f = { tonic: 65, minor: false }
    expect([0, 2, 4, 7].map((d) => keyNote(f, d))).toEqual([65, 69, 72, 77])
    expect(keyNote(f, -1)).toBe(64)
    expect(keyNote(f, 4, 1)).toBe(84)
    const a = { tonic: 69, minor: true }
    expect([0, 2, 4, 5].map((d) => keyNote(a, d))).toEqual([69, 72, 76, 77])
  })
})

describe('spatial', () => {
  const out = { pan: 0, cutoffHz: 0 }
  it('pans with the screen position and dulls with distance', () => {
    expect(spatial(0, -20, 0.8, out)).toEqual({ pan: 0, cutoffHz: 18000 })
    expect(spatial(80, -100, 0.8, out).pan).toBeCloseTo(0.75)
    expect(spatial(-40, -100, 0.8, out).pan).toBeCloseTo(-0.375)
    expect(spatial(0, -400, 0.8, out).cutoffHz).toBeCloseTo(2400)
    const mid = spatial(0, -125, 0.8, out).cutoffHz
    expect(mid).toBeGreaterThan(2400)
    expect(mid).toBeLessThan(18000)
  })

  it('pans a sound behind the camera fully to its side', () => {
    expect(spatial(5, 10, 0.8, out).pan).toBeCloseTo(0.75)
    expect(spatial(-5, 10, 0.8, out).pan).toBeCloseTo(-0.75)
  })
})

describe('nextBeat', () => {
  const out = { t: 0, beatInBar: 0 }
  it('lands on the next beat of the grid, with its place in the bar', () => {
    expect(nextBeat(10.1, 10, 0.5, 4, 0.02, out)).toEqual({ t: 10.5, beatInBar: 1 })
    expect(nextBeat(11.49, 10, 0.5, 4, 0.02, out)).toEqual({ t: 12, beatInBar: 0 })
    expect(nextBeat(11.47, 10, 0.5, 4, 0.02, out).t).toBe(11.5)
  })

  it('waits for the score to start', () => {
    expect(nextBeat(9, 10, 0.5, 4, 0.02, out)).toEqual({ t: 10, beatInBar: 0 })
  })
})

describe('rates', () => {
  it('pitch climbs with the combo and the boss damage, within an octave', () => {
    expect(killRate(0)).toBe(1)
    expect(killRate(12)).toBeGreaterThan(killRate(4))
    expect(killRate(99)).toBe(killRate(12))
    expect(hitRate(15)).toBeGreaterThan(hitRate(0))
    expect(bossHitRate(0.2)).toBeGreaterThan(bossHitRate(1))
    expect(bossHitRate(0)).toBeLessThan(2)
  })
})

describe('recipes', () => {
  it('every arcade sound has exactly one recipe, and every kill timbre a body', () => {
    const ids = RECIPES.map((r) => r.id).sort()
    expect(ids).toEqual((Object.keys(ARCADE_SOUNDS) as ArcadeSoundId[]).sort())
    for (const sound of Object.keys(KILL_TIMBRES)) expect(ids).toContain(`kill.${sound}`)
  })

  it('guns stay dry and short, so they are silent within 150 ms', () => {
    const fire = RECIPES.find((r) => r.id === 'fire')!
    const spec = { key: { tonic: 60, minor: false }, beatS: 0.4, beats: 4, biome: 'themePark' as const, boss: false, fireworks: false }
    expect(ARCADE_SOUNDS.fire.send).toBe(0)
    expect(fire.lengthS(spec, 0)).toBeLessThanOrEqual(0.16)
  })

  it('kills outrank hits and guns, level cues outrank every combat sound, and kills sit 6 dB over the gun', () => {
    expect(ARCADE_SOUNDS['kill.pop'].prio).toBeGreaterThan(ARCADE_SOUNDS.hit.prio)
    expect(ARCADE_SOUNDS.hit.prio).toBeGreaterThan(ARCADE_SOUNDS.fire.prio)
    expect(ARCADE_SOUNDS.waveTell.prio).toBeGreaterThan(ARCADE_SOUNDS['kill.payout'].prio)
    expect(ARCADE_SOUNDS['kill.pop'].db).toBeGreaterThanOrEqual(ARCADE_SOUNDS.fire.db + 6)
  })
})

describe('bake helpers', () => {
  it('trims the silence after a sound and fades its last samples', () => {
    const x = new Float32Array(1000)
    for (let i = 0; i < 300; i++) x[i] = Math.sin(i) * (1 - i / 300)
    const y = trimTail(x, 44100)
    expect(y.length).toBeLessThanOrEqual(300)
    expect(y.length).toBeGreaterThan(250)
    expect(Math.abs(y[y.length - 1])).toBeLessThan(1e-3)
  })

  it('folds a loop tail back onto its start', () => {
    const y = foldLoop(Float32Array.from([1, 2, 3, 4, 5, 6]), 4)
    expect([...y]).toEqual([6, 8, 3, 4])
  })

  it('normalises to a 0 dBFS peak', () => {
    const x = Float32Array.from([0.1, -0.25, 0.2])
    normalise(x)
    expect(Math.max(...x.map(Math.abs))).toBe(1)
  })
})
