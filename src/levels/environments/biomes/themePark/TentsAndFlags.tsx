import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { type ThemeParkLayout, paletteColors } from './parkSpec'
import StaticInstances from '../../shared/StaticInstances'

/** The park's tents and flag poles, four draw calls; the title park shares them (#493), sized by each placement's `scale`. */
export default function TentsAndFlags({ layout }: { layout: Pick<ThemeParkLayout, 'tents' | 'flagPoles'> }) {
  const { tents, flagPoles } = layout
  const assets = useMemo(
    () => ({
      // The base and pole sink below y = 0 so they don't float on slopes.
      tentBase: new THREE.CylinderGeometry(24, 24, 24, 6).translate(0, 4, 0),
      tentRoof: new THREE.ConeGeometry(25, 40, 6).translate(0, 36, 0),
      pole: new THREE.CylinderGeometry(1, 1, 52, 4).translate(0, 24, 0),
      flag: new THREE.BoxGeometry(6, 4, 0.5).translate(3, 45, 0),
      white: new THREE.MeshPhongMaterial({ color: '#ffffff', flatShading: true }),
      grey: new THREE.MeshPhongMaterial({ color: '#888888', flatShading: true }),
      tinted: new THREE.MeshPhongMaterial({ flatShading: true, specular: '#333333', shininess: 30 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])

  const tentColors = useMemo(() => paletteColors(tents.map((t) => t.color)), [tents])
  const flagColors = useMemo(() => paletteColors(flagPoles.map((f) => f.color)), [flagPoles])

  return (
    <>
      <StaticInstances placements={tents} geometry={assets.tentBase} material={assets.white} />
      <StaticInstances placements={tents} colors={tentColors} geometry={assets.tentRoof} material={assets.tinted} />
      <StaticInstances placements={flagPoles} geometry={assets.pole} material={assets.grey} />
      <StaticInstances placements={flagPoles} colors={flagColors} geometry={assets.flag} material={assets.tinted} />
    </>
  )
}
