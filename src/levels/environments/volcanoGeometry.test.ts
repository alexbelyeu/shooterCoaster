import { describe, expect, it } from 'vitest'
import { LAVA_STREAKS, VOLCANO, buildLavaStreaks, buildVolcanoRock, coneRadius } from './volcanoGeometry'

describe('volcano rock', () => {
  const geo = buildVolcanoRock()
  const pos = geo.attributes.position
  const glow = geo.attributes.glow

  it('has colour and glow for every vertex (one draw with the terrain material)', () => {
    expect(geo.attributes.color.count).toBe(pos.count)
    expect(glow.count).toBe(pos.count)
  })

  it('glows hottest at the crater lip and not at all at the base', () => {
    let rimMax = 0
    let baseMax = 0
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y > VOLCANO.height) rimMax = Math.max(rimMax, glow.getX(i))
      if (y < 1) baseMax = Math.max(baseMax, glow.getX(i))
    }
    expect(rimMax).toBeGreaterThan(1) // HDR: Bloom picks it up
    expect(baseMax).toBe(0)
  })
})

describe('lava streaks', () => {
  const geo = buildLavaStreaks()
  const pos = geo.attributes.position
  const uv = geo.attributes.uv

  it('stand proud of the cone, from below the crater down to each streak bottom', () => {
    const lowest = Math.min(...LAVA_STREAKS.map(s => s.bottomY))
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      expect(y).toBeGreaterThanOrEqual(lowest)
      expect(y).toBeLessThanOrEqual(VOLCANO.height)
      expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeGreaterThan(coneRadius(y))
    }
  })

  it('measure uv.y in streak widths, growing uphill so the lava flows down', () => {
    const rows = pos.count / LAVA_STREAKS.length / 2
    const first = LAVA_STREAKS[0]
    const topV = uv.getY((rows - 1) * 2)
    const slant = Math.hypot(VOLCANO.height - first.bottomY, coneRadius(first.bottomY) - coneRadius(VOLCANO.height))
    expect(uv.getY(0)).toBe(0)
    expect(topV).toBeGreaterThan((slant / first.width) * 0.8)
  })
})
