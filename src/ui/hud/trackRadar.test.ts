import { describe, expect, it } from 'vitest'
import { shippedLevels } from '@/levels/shippedLevels'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { hardRouteOf } from '@/track/mechanics'
import { sampleTrackXZ, setTrackOutline, trackOutline } from '@/track/trackOutline'
import { fitRadar, inRadar, radarBox, radarLongSide, radarShown, radarX, radarY } from './trackRadar'

const xz = (...pairs: number[]) => Float32Array.from(pairs)

describe('fitRadar', () => {
  // A 200 × 100 rectangle from (-100, -50) to (100, 50).
  const rect = xz(-100, -50, 100, -50, 100, 50, -100, 50)

  it('fits the track inside the padded box, centred', () => {
    const fit = fitRadar([rect], 120, 120, 10)
    expect(fit.scale).toBeCloseTo(0.5)
    expect(radarX(fit, -100)).toBeCloseTo(10)
    expect(radarX(fit, 100)).toBeCloseTo(110)
    expect(radarY(fit, -50)).toBeCloseTo(35)
    expect(radarY(fit, 50)).toBeCloseTo(85)
  })

  it('keeps the aspect: one scale for both axes', () => {
    const fit = fitRadar([rect], 300, 60, 0)
    const w = radarX(fit, 100) - radarX(fit, -100)
    const h = radarY(fit, 50) - radarY(fit, -50)
    expect(w / h).toBeCloseTo(2)
    expect(h).toBeCloseTo(60)
  })

  it('maps a known point where expected: the centre to the middle, +z down the page', () => {
    const fit = fitRadar([xz(1000, 2000, 1200, 2400)], 100, 100, 0)
    expect(radarX(fit, 1100)).toBeCloseTo(50)
    expect(radarY(fit, 2200)).toBeCloseTo(50)
    expect(radarY(fit, 2400)).toBeGreaterThan(radarY(fit, 2000))
  })

  it('fits every path, a junction branch included', () => {
    const fit = fitRadar([rect, xz(0, 0, 300, 0)], 100, 100, 0)
    expect(radarX(fit, 300)).toBeCloseTo(100)
    expect(radarX(fit, -100)).toBeCloseTo(0)
  })
})

describe('radarBox', () => {
  it('follows the track shape, the short side at least 60 % of the long', () => {
    expect(radarBox([xz(0, 0, 200, 150)], 100)).toEqual({ width: 100, height: 75 })
    expect(radarBox([xz(0, 0, 50, 300)], 100)).toEqual({ width: 60, height: 100 })
  })
})

describe('radarShown', () => {
  it('shows in landscape, hides in portrait (a phone held upright)', () => {
    expect(radarShown(1280, 720)).toBe(true)
    expect(radarShown(844, 390)).toBe(true)
    expect(radarShown(390, 844)).toBe(false)
    expect(radarShown(800, 800)).toBe(false)
  })

  it('sizes the box from the screen, within 84–150 px', () => {
    expect(radarLongSide(844, 390)).toBe(94)
    expect(radarLongSide(1920, 1080)).toBe(150)
    expect(radarLongSide(500, 300)).toBe(84)
  })
})

describe('every level', () => {
  it('fits each track, and a junction hard route, inside its box', () => {
    const misses: string[] = []
    for (const level of shippedLevels()) {
      const main = createTrackCurve(level.track)
      const hard = level.track.mechanics && hardRouteOf(main, level.track.mechanics)
      const paths = hard ? [sampleTrackXZ(main), sampleTrackXZ(hard)] : [sampleTrackXZ(main)]
      const box = radarBox(paths, 150)
      const fit = fitRadar(paths, box.width, box.height, 8)
      for (const path of paths) {
        for (let i = 0; i < path.length; i += 2) {
          const x = radarX(fit, path[i])
          const y = radarY(fit, path[i + 1])
          if (!inRadar(fit, x, y) || x < 7.99 || y < 7.99 || x > box.width - 7.99 || y > box.height - 7.99) {
            misses.push(`${level.id} (${x.toFixed(1)}, ${y.toFixed(1)})`)
            break
          }
        }
      }
    }
    expect(misses).toEqual([])
  })
})

describe('trackOutline', () => {
  it("answers only for the level that published it, never with another level's track", () => {
    const paths = [Float32Array.from([0, 0, 1, 1])]
    setTrackOutline('level2', paths)
    expect(trackOutline('level2')).toBe(paths)
    expect(trackOutline('level3')).toBeNull()
  })
})
