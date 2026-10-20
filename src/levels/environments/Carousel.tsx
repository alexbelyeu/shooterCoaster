import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergePainted, painted } from './shared/paintedParts'

interface CarouselProps {
  position?: [number, number, number]
  radius?: number
  horseCount?: number
}

const ROTATION_SPEED = 0.3 // rad/s
const HORSE_COLORS = ['#ff4444', '#ffcc00', '#4488ff', '#44cc44', '#ff44ff', '#ffffff', '#ff8800', '#cc33ff']
const HORSE_Y = 10
const BOB = 3

const _m = new THREE.Matrix4()
const _c = new THREE.Color()

/** Centre pole, cone roof, platform and the horses' brass poles (rotates as one). */
function buildBody(radius: number, angles: number[]) {
  const parts = [
    painted(new THREE.CylinderGeometry(1.5, 1.5, 40, 8), '#cccccc', [0, 20, 0]),
    painted(new THREE.ConeGeometry(radius + 5, 12, 12), '#ff3333', [0, 38, 0]),
    painted(new THREE.CylinderGeometry(radius, radius, 4, 16), '#ddaa44', [0, 2, 0]),
  ]
  for (const a of angles) {
    const x = Math.cos(a) * radius * 0.7
    const z = Math.sin(a) * radius * 0.7
    parts.push(painted(new THREE.CylinderGeometry(0.5, 0.5, 28, 4), '#cccccc', [x, 18, z]))
  }
  return mergePainted(parts)
}

/** Simplified horse: body + head, tinted per instance. */
function buildHorse() {
  return mergePainted([
    painted(new THREE.BoxGeometry(6, 5, 3), '#ffffff'),
    painted(new THREE.BoxGeometry(3, 3, 2), '#ffffff', [4, 2, 0]),
  ])
}

/**
 * Animated carousel: cone roof + platform + horses bobbing up and down their
 * poles. Two draw calls: the rotating body and the horses (InstancedMesh).
 */
export default function Carousel({
  position = [0, 0, 0],
  radius = 25,
  horseCount = 8,
}: CarouselProps) {
  const platformRef = useRef<THREE.Group>(null)
  const horsesRef = useRef<THREE.InstancedMesh | null>(null)
  const timeRef = useRef(0)

  const angles = useMemo(
    () => Array.from({ length: horseCount }, (_, i) => (i / horseCount) * Math.PI * 2),
    [horseCount],
  )

  const assets = useMemo(
    () => ({
      body: buildBody(radius, angles),
      horse: buildHorse(),
      painted: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true }),
      tinted: new THREE.MeshPhongMaterial({ flatShading: true }),
    }),
    [radius, angles],
  )
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])

  const placeHorses = useCallback(
    (time: number) => {
      const mesh = horsesRef.current
      if (!mesh) return
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i]
        // Head (+x) along the direction of travel.
        _m.makeRotationY(Math.PI / 2 - a).setPosition(
          Math.cos(a) * radius * 0.7,
          HORSE_Y + Math.sin(time * 2 + a) * BOB,
          Math.sin(a) * radius * 0.7,
        )
        mesh.setMatrixAt(i, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [angles, radius],
  )

  const setHorses = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      horsesRef.current = mesh
      if (!mesh) return
      for (let i = 0; i < angles.length; i++) mesh.setColorAt(i, _c.set(HORSE_COLORS[i % HORSE_COLORS.length]))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      placeHorses(timeRef.current)
      // Bob is ±BOB around a fixed ring: pad the sphere once instead of recomputing it.
      mesh.computeBoundingSphere()
      if (mesh.boundingSphere) mesh.boundingSphere.radius += BOB
    },
    [angles, placeHorses],
  )

  useFrame((_, delta) => {
    timeRef.current += delta
    if (platformRef.current) platformRef.current.rotation.y += ROTATION_SPEED * delta
    placeHorses(timeRef.current)
  })

  return (
    <group position={position}>
      <group ref={platformRef}>
        <mesh geometry={assets.body} material={assets.painted} />
        <instancedMesh ref={setHorses} args={[assets.horse, assets.tinted, angles.length]} />
      </group>
    </group>
  )
}
