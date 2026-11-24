import { useEffect, useMemo } from 'react'
import type { BiomeDecorationsProps } from '@/levels/environments/shared/types'
import { trackExtent } from '@/levels/environments/shared/trackScatter'
import StaticInstances from '@/levels/environments/shared/StaticInstances'
import { layoutCity } from './cityLayout'
import { createNeonMaterial, createTowerGeometry, neonGeometry, towerMatrix } from './cityNeon'
import { createTowerMaterial } from './cityShaders'

/** The city (#323): every tower and the skyline as one instanced draw call with lit windows, all the neon as one more. */
export default function CityDecorations({ groundFn, track }: BiomeDecorationsProps) {
  const layout = useMemo(() => layoutCity(track, trackExtent(track)), [track])
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
    </>
  )
}
