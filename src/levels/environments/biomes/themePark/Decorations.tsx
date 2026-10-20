import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BiomeDecorationsProps } from '../../shared/types'
import { type ThemeParkLayout, getThemeParkLayout } from './layout'
import { placeInstances } from './instancing'
import Midway from './Midway'

/** Height-baked geometry with its base `bury` units below y = 0. */
function grounded(geo: THREE.BufferGeometry, height: number, bury = 0) {
  return geo.translate(0, height / 2 - bury, 0)
}

/** Background dressing beyond the midway: big tents, a hedge boundary, flag poles. */
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

  const placeTents = useMemo(() => placeInstances(tents), [tents])
  const placeTentRoofs = useMemo(() => placeInstances(tents, tents.map((t) => t.color)), [tents])
  const placeHedges = useMemo(() => placeInstances(hedges), [hedges])
  const placePoles = useMemo(() => placeInstances(flagPoles), [flagPoles])
  const placeFlags = useMemo(() => placeInstances(flagPoles, flagPoles.map((f) => f.color)), [flagPoles])

  return (
    <>
      {tents.length > 0 && (
        <>
          <instancedMesh ref={placeTents} args={[assets.tentBase, assets.white, tents.length]} />
          <instancedMesh ref={placeTentRoofs} args={[assets.tentRoof, assets.tinted, tents.length]} />
        </>
      )}
      {hedges.length > 0 && <instancedMesh ref={placeHedges} args={[assets.hedge, assets.green, hedges.length]} />}
      {flagPoles.length > 0 && (
        <>
          <instancedMesh ref={placePoles} args={[assets.pole, assets.grey, flagPoles.length]} />
          <instancedMesh ref={placeFlags} args={[assets.flag, assets.tinted, flagPoles.length]} />
        </>
      )}
    </>
  )
}

/** Theme park decorations: the midway along the track plus background scatter (see layout.ts). */
export default function FunfairDecorations({ heightFn, groundFn, track }: BiomeDecorationsProps) {
  const layout = useMemo(() => getThemeParkLayout(track, heightFn, groundFn), [track, heightFn, groundFn])
  return (
    <>
      <Midway layout={layout} />
      <Scatter layout={layout} />
    </>
  )
}
