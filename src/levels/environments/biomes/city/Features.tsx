import { useEffect, useMemo } from 'react'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import type { NeonSign, Tower } from './cityLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix } from './cityNeon'
import { createTowerMaterial } from './cityShaders'
import { LANDMARK_SITE, SPIRE_HEIGHT } from './config'

/** The hero tower's tiers, widest first: each stands on the one below. */
const TIERS = [
  { w: 260, h: 0.42 },
  { w: 190, h: 0.28 },
  { w: 120, h: 0.18 },
] as const
const NEEDLE = { w: 10, h: SPIRE_HEIGHT * 0.12 }
const CROWN = { h: 7, d: 4 }

function heroTower(): { tiers: Tower[]; neon: NeonSign[] } {
  const tiers: Tower[] = []
  const neon: NeonSign[] = []
  let base = 0
  for (const [i, t] of TIERS.entries()) {
    const h = SPIRE_HEIGHT * t.h
    tiers.push({ x: LANDMARK_SITE.x, z: LANDMARK_SITE.z, w: t.w, d: t.w, h: base + h })
    base += h
    // A neon crown round the top of each tier, magenta and cyan in turn
    const color = i % 2 === 0 ? 'magenta' : 'cyan'
    for (const side of [0, 1, 2, 3]) {
      const yaw = (side * Math.PI) / 2
      const out = t.w / 2 + CROWN.d / 2
      neon.push({
        x: LANDMARK_SITE.x + Math.sin(yaw) * out,
        y: base - CROWN.h,
        z: LANDMARK_SITE.z + Math.cos(yaw) * out,
        w: t.w + CROWN.d * 2,
        h: CROWN.h,
        d: CROWN.d,
        yaw,
        color,
      })
    }
  }
  neon.push({ x: LANDMARK_SITE.x, y: base + NEEDLE.h / 2, z: LANDMARK_SITE.z, w: NEEDLE.w, h: NEEDLE.h, d: NEEDLE.w, yaw: 0, color: 'amber' })
  return { tiers, neon }
}

/** The hero tower beyond the track (#323): a stepped skyscraper with lit windows, neon crowns and a lit needle. */
export default function CityFeatures({ groundFn }: BiomeFeaturesProps) {
  const hero = useMemo(heroTower, [])
  const towerGeometry = useMemo(createTowerGeometry, [])
  const towerMaterial = useMemo(createTowerMaterial, [])
  const neonMaterial = useMemo(createNeonMaterial, [])
  const neon = useMemo(() => neonGeometry(hero.neon), [hero])
  const ground = groundFn(LANDMARK_SITE.x, LANDMARK_SITE.z)
  const matrices = useMemo(() => hero.tiers.map((t) => towerMatrix(t, ground)), [hero, ground])

  useEffect(
    () => () => {
      towerGeometry.dispose()
      towerMaterial.dispose()
      neonMaterial.dispose()
      neon.dispose()
    },
    [towerGeometry, towerMaterial, neonMaterial, neon],
  )

  return (
    <>
      <StaticInstances matrices={matrices} geometry={towerGeometry} material={towerMaterial} />
      <mesh geometry={neon} material={neonMaterial} position-y={ground} />
    </>
  )
}
