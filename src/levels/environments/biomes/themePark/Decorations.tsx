import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { getThemeParkLayout } from './layout'
import type { ThemeParkLayout } from './parkSpec'
import Midway from './Midway'
import TentsAndFlags from './TentsAndFlags'
import { themeParkShadowCasters } from './shadows'
import { useContactShadows } from '../../shared/ContactShadows'
import StaticInstances from '../../shared/StaticInstances'

function Hedges({ hedges }: { hedges: ThemeParkLayout['hedges'] }) {
  const assets = useMemo(
    () => ({
      // Sunk 4 below y = 0 so it doesn't float on slopes.
      hedge: new THREE.BoxGeometry(18, 14, 6).translate(0, 3, 0),
      green: new THREE.MeshPhongMaterial({ color: '#2d6b2d', flatShading: true }),
    }),
    [],
  )
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])
  return <StaticInstances placements={hedges} geometry={assets.hedge} material={assets.green} />
}

export default function FunfairDecorations({ heightFn, groundFn, track, atmosphere }: BiomeDecorationsProps) {
  const layout = useMemo(() => getThemeParkLayout(track, heightFn, groundFn), [track, heightFn, groundFn])
  useContactShadows(useMemo(() => themeParkShadowCasters(layout), [layout]))
  return (
    <>
      <Midway layout={layout} lampGlow={atmosphere.lampGlow} />
      <TentsAndFlags layout={layout} />
      <Hedges hedges={layout.hedges} />
    </>
  )
}
