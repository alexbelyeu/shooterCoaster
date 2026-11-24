import { useEffect, useMemo } from 'react'
import type { BiomeDecorationsProps } from '@/levels/environments/shared/types'
import { trackExtent } from '@/levels/environments/shared/trackScatter'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { CITY_REACH, layoutCity, towersOf } from './cityLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix, useNeonClock } from './cityNeon'
import { createTowerMaterial } from './cityShaders'
import Traffic from './Traffic'
import { laneRuns, layoutTraffic } from './trafficPaths'

/** The city (#323): the towers and skyline in one instanced draw call, all the neon in one more, the traffic (#324) in a third. */
export default function CityDecorations({ groundFn, track }: BiomeDecorationsProps) {
  const extent = useMemo(() => trackExtent(track), [track])
  const layout = useMemo(() => layoutCity(track, extent), [track, extent])
  // `terrainNoise`'s city is flat out past the skyline
  const traffic = useMemo(
    () => layoutTraffic(laneRuns(track, extent * CITY_REACH, towersOf(layout)), groundFn(0, 0)),
    [track, extent, layout, groundFn],
  )
  useNeonClock()
  const towerGeometry = useMemo(createTowerGeometry, [])
  const towerMaterial = useMemo(createTowerMaterial, [])
  const neonMaterial = useMemo(createNeonMaterial, [])
  const neon = useMemo(() => neonGeometry(layout.signs), [layout])
  const matrices = useMemo(
    () => [...layout.towers, ...layout.skyline].map((t) => towerMatrix(t, groundFn(t.x, t.z))),
    [layout, groundFn],
  )

  useEffect(
    () => () => {
      towerGeometry.dispose()
      towerMaterial.dispose()
      neonMaterial.dispose()
    },
    [towerGeometry, towerMaterial, neonMaterial],
  )
  useEffect(() => () => neon.dispose(), [neon])

  return (
    <>
      <StaticInstances matrices={matrices} geometry={towerGeometry} material={towerMaterial} />
      <mesh geometry={neon} material={neonMaterial} />
      <Traffic traffic={traffic} />
    </>
  )
}
