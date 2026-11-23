import { useEffect, useMemo } from 'react'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { layoutHeroTower } from './cityLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix } from './cityNeon'
import { createTowerMaterial } from './cityShaders'
import { LANDMARK_SITE } from './config'

/** The hero tower beyond the track (#323): a stepped skyscraper with lit windows, neon crowns and a lit needle. */
export default function CityFeatures({ groundFn }: BiomeFeaturesProps) {
  const hero = useMemo(layoutHeroTower, [])
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
