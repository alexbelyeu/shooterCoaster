import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SmokeColumn from './SmokeColumn'
import { createTerrainMaterial } from './shared/terrainMesh'
import { CONE_HOLE, VOLCANO, buildLavaStreaks, buildVolcanoRock } from './volcanoGeometry'

interface VolcanoProps {
  position: [number, number, number]
  lavaMaterial: THREE.Material
  /** World points the track rides through the flank (#867): the rock is cut round each and drawn inside too. */
  holes?: readonly { x: number; y: number; z: number }[]
}

/** Holes the rock's shader cuts; unused slots sit far away. */
const MAX_HOLES = 4

/** The rock cut round `holes` (a sphere of `CONE_HOLE.radius` each) and two-sided, so the hollow cone is seen from inside. */
function cutHoles(material: THREE.MeshPhongMaterial, holes: readonly { x: number; y: number; z: number }[]): void {
  if (holes.length > MAX_HOLES) throw new Error(`volcano: at most ${MAX_HOLES} holes`)
  const centres = Array.from({ length: MAX_HOLES }, (_, i) => (holes[i] ? new THREE.Vector3(holes[i].x, holes[i].y, holes[i].z) : new THREE.Vector3(0, -1e9, 0)))
  const glow = material.onBeforeCompile
  material.side = THREE.DoubleSide
  material.onBeforeCompile = (shader, renderer) => {
    glow(shader, renderer)
    shader.uniforms.uHoles = { value: centres }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHoleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uHoles[${MAX_HOLES}];\nvarying vec3 vHoleWorld;`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\nfor (int i = 0; i < ${MAX_HOLES}; i++) if (distance(vHoleWorld, uHoles[i]) < ${CONE_HOLE.radius.toFixed(1)}) discard;`,
      )
  }
  material.customProgramCacheKey = () => 'terrain-glow-holes'
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
export default function Volcano({ position, lavaMaterial, holes }: VolcanoProps) {
  const coreRef = useRef<THREE.MeshStandardMaterial>(null)
  const rockGeo = useMemo(buildVolcanoRock, [])
  const rockMat = useMemo(() => {
    const material = createTerrainMaterial(ROCK_GLOW)
    if (holes?.length) cutHoles(material, holes)
    return material
  }, [holes])
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
