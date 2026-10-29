import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SmokeColumn from './SmokeColumn'
import { createTerrainMaterial } from './shared/terrainMesh'
import { VOLCANO, buildLavaStreaks, buildVolcanoRock } from './volcanoGeometry'

interface VolcanoProps {
  position: [number, number, number]
  lavaMaterial: THREE.Material
}

/** Emissive colour of the rock's `glow` attribute. */
const ROCK_GLOW = { color: 0xff7a2a, intensity: 1 }

/** Smoke puffs rising from the crater (y = 1600), widening as they climb. */
const SMOKE_PUFFS = [
  { y: 2050, halfWidth: 380, halfHeight: 520 },
  { y: 2650, halfWidth: 560, halfHeight: 640 },
  { y: 3400, halfWidth: 800, halfHeight: 780 },
]

/** Erupting volcano: glowing rock + rim (one draw), pulsing crater core, lava streaks (one draw), smoke column. */
export default function Volcano({ position, lavaMaterial }: VolcanoProps) {
  const coreRef = useRef<THREE.MeshStandardMaterial>(null)
  const rockGeo = useMemo(buildVolcanoRock, [])
  const rockMat = useMemo(() => createTerrainMaterial(ROCK_GLOW), [])
  const streakGeo = useMemo(buildLavaStreaks, [])

  useEffect(() => () => {
    rockGeo.dispose()
    rockMat.dispose()
    streakGeo.dispose()
  }, [rockGeo, rockMat, streakGeo])

  useFrame(({ clock }) => {
    if (coreRef.current) coreRef.current.emissiveIntensity = 2.5 + Math.sin(clock.elapsedTime * 2) * 0.8
  })

  return (
    <group position={position}>
      <mesh geometry={rockGeo} material={rockMat} />
      <mesh position={[0, VOLCANO.height - 30, 0]}>
        <sphereGeometry args={[VOLCANO.rimRadius - 40, 12, 8]} />
        <meshStandardMaterial ref={coreRef} color="#ff5a10" emissive="#ff4a10" emissiveIntensity={2.5} />
      </mesh>
      <mesh geometry={streakGeo} material={lavaMaterial} />
      <SmokeColumn puffs={SMOKE_PUFFS} />
    </group>
  )
}
