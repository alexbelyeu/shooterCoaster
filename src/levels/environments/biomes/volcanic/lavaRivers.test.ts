import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { RUN_SECONDS } from '@/levels/pacing'
import { buildArcTable, tAtLoopDistance } from '@/track/arcLength'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { rideProfile, rideSpeeds } from '@/track/ridePhysics'
import { createHeightFunction, createTerrainSurface, getTerrainMeshSize, sampleTrackPath } from '@/utils/terrainNoise'
import { createLavaRiverGeometries, RIVER_COLUMNS } from './lavaRivers'
import { RIVER_CONFIGS, RIVER_SEGMENTS, riverRow } from './lavaRiverPaths'

const level = getLevelConfig('level5')!
const curve = createTrackCurve(level.track)
const table = buildArcTable(curve)
const heightFn = createHeightFunction('volcanic', sampleTrackPath((t) => curve.getPointAt(t)))
const groundFn = createTerrainSurface(heightFn, getTerrainMeshSize('volcanic'))

/** Where the rider is and which way it faces (XZ), every half second of the run. */
function riderViews() {
  const profile = rideProfile(table, rideSpeeds(level.track), RUN_SECONDS)
  const views: { x: number; z: number; fx: number; fz: number }[] = []
  for (let k = 0; k < profile.length; k += 5) {
    const t = tAtLoopDistance(table, profile[k])
    const p = curve.getPointAt(t).clone()
    const q = curve.getPointAt((t + 0.003) % 1)
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1
    views.push({ x: p.x, z: p.z, fx: (q.x - p.x) / len, fz: (q.z - p.z) / len })
  }
  return views
}

describe('lava rivers (level5)', () => {
  it("never run down the rider's line of sight (#331: one there stood up the view like a glowing wall)", () => {
    const halfView = 0.35
    const alongSight = Math.cos(0.45)
    let worst = 0
    for (const view of riderViews()) {
      for (const cfg of RIVER_CONFIGS) {
        let sightline = 0
        for (let i = 1; i <= RIVER_SEGMENTS; i++) {
          const a = riverRow(cfg, i - 1)
          const b = riverRow(cfg, i)
          const step = Math.hypot(b.cx - a.cx, b.cz - a.cz)
          const vx = b.cx - view.x
          const vz = b.cz - view.z
          const dist = Math.hypot(vx, vz)
          const inView = (vx * view.fx + vz * view.fz) / dist > Math.cos(halfView)
          const along = Math.abs(((b.cx - a.cx) * vx + (b.cz - a.cz) * vz) / (step * dist)) > alongSight
          if (inView && along) sightline += step
        }
        worst = Math.max(worst, sightline)
      }
    }
    expect(worst).toBeLessThan(400)
  })

  it('each crosses under the track', () => {
    const track = Array.from({ length: 1500 }, (_, i) => curve.getPointAt(i / 1500).clone())
    for (const cfg of RIVER_CONFIGS) {
      let under = 0
      for (let i = 0; i <= RIVER_SEGMENTS; i++) {
        const { cx, cz } = riverRow(cfg, i)
        if (track.some(p => Math.hypot(p.x - cx, p.z - cz) < cfg.halfWidth)) under++
      }
      expect(under).toBeGreaterThan(0)
    }
  })

  it('lie on the drawn ground: never under it, never floating', () => {
    let lowest = Infinity
    let highest = -Infinity
    const cols = RIVER_COLUMNS + 1
    for (const geo of createLavaRiverGeometries(groundFn)) {
      const pos = geo.attributes.position
      // Each quad's corner and the midpoints of its edges: the ground folds between vertices
      for (let i = 0; i < RIVER_SEGMENTS; i++) {
        for (let j = 0; j < RIVER_COLUMNS; j++) {
          const k = i * cols + j
          for (const [m, n] of [[k, k], [k, k + 1], [k, k + cols], [k + 1, k + cols]]) {
            const x = (pos.getX(m) + pos.getX(n)) / 2
            const y = (pos.getY(m) + pos.getY(n)) / 2
            const z = (pos.getZ(m) + pos.getZ(n)) / 2
            const above = y - groundFn(x, z)
            lowest = Math.min(lowest, above)
            highest = Math.max(highest, above)
          }
        }
      }
      geo.dispose()
    }
    expect(lowest).toBeGreaterThan(0)
    expect(highest).toBeLessThan(25)
  })
})
