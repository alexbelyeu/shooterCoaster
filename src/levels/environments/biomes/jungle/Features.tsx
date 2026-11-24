import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BiomeFeaturesProps } from '@/levels/environments/shared/types'
import { buildRingedRock } from '@/levels/environments/shared/ringedRock'
import { useContactShadows } from '@/levels/environments/shared/ContactShadows'
import { roundCaster } from '@/levels/environments/shared/contactShadows'
import { mergePainted } from '@/levels/environments/shared/paintedParts'
import { FALLS, TEMPLE } from './config'
import { CLIFF, mistBanks } from './jungleLayout'
import { createMistMaterial, createWaterfallMaterial, mistGeometry } from './jungleShaders'
import { buildTempleGeometry } from './templeGeometry'

const CLIFF_BANDS = ['#6c6a55', '#5b5a48', '#7a765e', '#4f5440'].map((c) => new THREE.Color(c))
const CLIFF_MOSS = new THREE.Color('#4a6a2a')
/** The sheet's distance from the cliff's centre at its lip and where it lands: falling clear of the face. */
const SHEET_REACH = { lip: CLIFF.radius + 28, foot: CLIFF.radius + 52 }
const POOL_RADIUS = 140

/** The cliff as rings over the pool's ground: buried at its foot, its lip overhanging so the fall drops clear. */
function cliffGeometry(): THREE.BufferGeometry {
  const r = CLIFF.radius
  const rings = [
    { y: -220, r: r * 0.95 },
    { y: 0, r: r * 0.95 },
    { y: FALLS.drop * 0.45, r: r * 1.0 },
    { y: FALLS.drop, r: r * 1.08 },
    { y: FALLS.drop + 30, r: r * 0.98 },
  ]
  return buildRingedRock(rings, 14, 0.05, 871, CLIFF_BANDS, CLIFF_MOSS, 12)
}

/**
 * Jungle Ruins' set-pieces (#870): the stepped temple on its terrace ahead of the first drop and the waterfall
 * beside it, temple and cliff in one draw; the falling sheet, its pool and the mist banks in the valleys.
 */
export default function JungleFeatures({ groundFn, track }: BiomeFeaturesProps) {
  const stone = useMemo(() => {
    const temple = buildTempleGeometry()
      .rotateY(TEMPLE.yaw)
      .translate(TEMPLE.x, TEMPLE.ground, TEMPLE.z)
    const cliff = cliffGeometry().translate(CLIFF.x, FALLS.ground, CLIFF.z)
    return mergePainted([temple, cliff])
  }, [])
  const stoneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    [],
  )

  const sheet = useMemo(() => {
    const height = FALLS.drop
    const g = new THREE.PlaneGeometry(FALLS.width, height, 1, 10)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const v = pos.getY(i) / height + 0.5 // 1 at the lip
      // Out from the cliff's face, falling away from it as it drops
      pos.setZ(i, SHEET_REACH.lip + (SHEET_REACH.foot - SHEET_REACH.lip) * (1 - v) ** 2)
      pos.setY(i, v * height)
    }
    return g.rotateY(FALLS.yaw).translate(CLIFF.x, FALLS.ground, CLIFF.z)
  }, [])
  const sheetMat = useMemo(() => createWaterfallMaterial(), [])

  const pool = useMemo(
    () => new THREE.CircleGeometry(POOL_RADIUS, 32).rotateX(-Math.PI / 2).translate(FALLS.x, FALLS.ground + 3, FALLS.z),
    [],
  )
  const poolMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x3f7a6e, roughness: 0.15, metalness: 0.3 }),
    [],
  )

  const mist = useMemo(() => mistGeometry(mistBanks(track, groundFn)), [track, groundFn])
  const mistMat = useMemo(() => createMistMaterial(0xdfeadb, 0.4), [])

  useContactShadows(useMemo(() => [roundCaster(TEMPLE.x, TEMPLE.z, TEMPLE.base * 1.3, 0.5)], []))

  useFrame(({ clock }) => {
    sheetMat.uniforms.uTime.value = clock.elapsedTime
    mistMat.uniforms.uTime.value = clock.elapsedTime
  })

  useEffect(
    () => () => {
      for (const g of [stone, sheet, pool, mist]) g.dispose()
      for (const m of [stoneMat, sheetMat, poolMat, mistMat]) m.dispose()
    },
    [stone, sheet, pool, mist, stoneMat, sheetMat, poolMat, mistMat],
  )

  return (
    <>
      <mesh geometry={stone} material={stoneMat} />
      <mesh geometry={pool} material={poolMat} />
      <mesh geometry={sheet} material={sheetMat} renderOrder={1} />
      <mesh geometry={mist} material={mistMat} renderOrder={2} />
    </>
  )
}
