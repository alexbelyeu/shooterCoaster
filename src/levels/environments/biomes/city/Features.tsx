import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { layoutElevatedLine, layoutHeroTower } from './cityLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix } from './cityNeon'
import { createTowerMaterial } from './cityShaders'
import { ELEVATED_LINE, LANDMARK_SITE } from './config'

/**
 * The hero tower the ride winds round (#323, #871): a stepped skyscraper with lit windows, neon crowns and a lit needle;
 * and the elevated train line the ride passes under (#871): its deck, pillars and a standing train, lit by neon strips.
 */
export default function CityFeatures({ groundFn }: BiomeFeaturesProps) {
  const hero = useMemo(layoutHeroTower, [])
  const towerGeometry = useMemo(createTowerGeometry, [])
  const towerMaterial = useMemo(createTowerMaterial, [])
  const neonMaterial = useMemo(createNeonMaterial, [])
  const line = useMemo(layoutElevatedLine, [])
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x24222c, roughness: 0.7, metalness: 0.3 }), [])
  const neon = useMemo(() => neonGeometry(hero.neon), [hero])
  const lineNeon = useMemo(() => neonGeometry(line.neon), [line])
  const ground = groundFn(LANDMARK_SITE.x, LANDMARK_SITE.z)
  const matrices = useMemo(() => hero.tiers.map((t) => towerMatrix(t, ground)), [hero, ground])
  // The line's boxes stand at their own heights over the street (`towerMatrix`'s base, unsunk)
  const lineMatrices = useMemo(() => line.boxes.map((b) => towerMatrix(b, groundFn(b.x, b.z) + b.y, 0)), [line, groundFn])

  useEffect(
    () => () => {
      towerGeometry.dispose()
      towerMaterial.dispose()
      neonMaterial.dispose()
      neon.dispose()
      lineMaterial.dispose()
      lineNeon.dispose()
    },
    [towerGeometry, towerMaterial, neonMaterial, neon, lineMaterial, lineNeon],
  )

  return (
    <>
      <StaticInstances matrices={matrices} geometry={towerGeometry} material={towerMaterial} />
      <mesh geometry={neon} material={neonMaterial} position-y={ground} />
      <StaticInstances matrices={lineMatrices} geometry={towerGeometry} material={lineMaterial} />
      <mesh geometry={lineNeon} material={neonMaterial} position-y={groundFn(ELEVATED_LINE.trainX, ELEVATED_LINE.z)} />
    </>
  )
}
