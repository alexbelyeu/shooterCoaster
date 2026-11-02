import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { getThemeParkLayout } from './layout'
import { type ThemeParkLayout, paletteColors } from './parkSpec'
import Midway from './Midway'
import { themeParkShadowCasters } from './shadows'
import { useContactShadows } from '../../shared/ContactShadows'
import StaticInstances from '../../shared/StaticInstances'

/** Base `bury` units below y = 0, so props on slopes don't float. */
function grounded(geo: THREE.BufferGeometry, height: number, bury = 0) {
  return geo.translate(0, height / 2 - bury, 0)
}

function Scatter({ layout }: { layout: ThemeParkLayout }) {
  const { tents, hedges, flagPoles } = layout
  const assets = useMemo(
    () => ({
      tentBase: grounded(new THREE.CylinderGeometry(24, 24, 24, 6), 24, 8),
      tentRoof: new THREE.ConeGeometry(25, 40, 6).translate(0, 36, 0),
      hedge: grounded(new THREE.BoxGeometry(18, 14, 6), 14, 4),
      pole: grounded(new THREE.CylinderGeometry(1, 1, 52, 4), 52, 2),
      flag: new THREE.BoxGeometry(6, 4, 0.5).translate(3, 45, 0),
      white: new THREE.MeshPhongMaterial({ color: '#ffffff', flatShading: true }),
      green: new THREE.MeshPhongMaterial({ color: '#2d6b2d', flatShading: true }),
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
      <StaticInstances placements={hedges} geometry={assets.hedge} material={assets.green} />
      <StaticInstances placements={flagPoles} geometry={assets.pole} material={assets.grey} />
      <StaticInstances placements={flagPoles} colors={flagColors} geometry={assets.flag} material={assets.tinted} />
    </>
  )
}

export default function FunfairDecorations({ heightFn, groundFn, track }: BiomeDecorationsProps) {
  const layout = useMemo(() => getThemeParkLayout(track, heightFn, groundFn), [track, heightFn, groundFn])
  useContactShadows(useMemo(() => themeParkShadowCasters(layout), [layout]))
  return (
    <>
      <Midway layout={layout} />
      <Scatter layout={layout} />
    </>
  )
}
