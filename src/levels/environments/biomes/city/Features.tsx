import { useEffect, useMemo } from 'react'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { layoutHeroTower } from './cityLayout'
import { createHighwayMaterial, highwayGeometry } from './highwayGeometry'
import { HIGHWAY, highwayPylons } from './highwayLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix, useNeonClock } from './cityNeon'
import { createTowerMaterial } from './cityShaders'
import { LANDMARK_SITE } from './config'

/**
 * The hero tower the ride winds round (#323, #871): a stepped skyscraper with lit windows, neon crowns and a lit needle;
 * and the elevated highway the ride passes under (#921, #871), neon down both edges.
 */
export default function CityFeatures({ groundFn, track }: BiomeFeaturesProps) {
  const hero = useMemo(layoutHeroTower, [])
  const towerGeometry = useMemo(createTowerGeometry, [])
  const towerMaterial = useMemo(createTowerMaterial, [])
  const neonMaterial = useMemo(createNeonMaterial, [])
  const neon = useMemo(() => neonGeometry(hero.neon), [hero])
  const ground = groundFn(LANDMARK_SITE.x, LANDMARK_SITE.z)
  const matrices = useMemo(() => hero.tiers.map((t) => towerMatrix(t, ground)), [hero, ground])
  // `terrainNoise`'s city is flat out past the skyline
  const highway = useMemo(() => highwayGeometry(HIGHWAY, highwayPylons(HIGHWAY, track), groundFn(0, 0)), [track, groundFn])
  const highwayMaterial = useMemo(createHighwayMaterial, [])
  useNeonClock()

  useEffect(
    () => () => {
      towerGeometry.dispose()
      towerMaterial.dispose()
      neonMaterial.dispose()
      neon.dispose()
      highwayMaterial.dispose()
    },
    [towerGeometry, towerMaterial, neonMaterial, neon, highwayMaterial],
  )
  useEffect(
    () => () => {
      highway.structure.dispose()
      highway.neon.dispose()
    },
    [highway],
  )

  return (
    <>
      <StaticInstances matrices={matrices} geometry={towerGeometry} material={towerMaterial} />
      <mesh geometry={neon} material={neonMaterial} position-y={ground} />
      <mesh geometry={highway.structure} material={highwayMaterial} />
      <mesh geometry={highway.neon} material={neonMaterial} />
    </>
  )
}
