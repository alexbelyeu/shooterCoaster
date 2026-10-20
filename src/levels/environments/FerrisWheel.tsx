import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergePainted, painted } from './shared/paintedParts'

interface FerrisWheelProps {
  position?: [number, number, number]
  radius?: number
  gondolaCount?: number
}

const ROTATION_SPEED = 0.1 // rad/s
const GONDOLA_COLORS = ['#ff4444', '#4488ff', '#ffcc00', '#44cc44', '#ff44ff', '#ffffff']
const Z_GAP = 8 // distance between front and back frames

const _m = new THREE.Matrix4()
const _c = new THREE.Color()

/** A-frame supports, braces, base, axle and hub caps (static). */
function buildFrame(radius: number) {
  const hubY = radius + 10
  const legSpread = radius * 0.7
  const legLength = Math.sqrt((legSpread / 2) ** 2 + hubY ** 2)
  const legAngle = Math.atan2(legSpread / 2, hubY)
  const parts: THREE.BufferGeometry[] = []
  for (const z of [Z_GAP / 2, -Z_GAP / 2]) {
    parts.push(
      painted(new THREE.BoxGeometry(2.5, legLength, 2.5), '#555555', [-legSpread / 4, hubY / 2, z], [0, 0, -legAngle]),
      painted(new THREE.BoxGeometry(2.5, legLength, 2.5), '#555555', [legSpread / 4, hubY / 2, z], [0, 0, legAngle]),
      painted(new THREE.BoxGeometry(legSpread * 0.45, 1.5, 1.5), '#444444', [0, hubY * 0.3, z]),
      painted(new THREE.BoxGeometry(legSpread * 0.22, 1.5, 1.5), '#444444', [0, hubY * 0.6, z]),
    )
  }
  for (const x of [-legSpread * 0.35, legSpread * 0.35]) {
    parts.push(painted(new THREE.BoxGeometry(1.5, 1.5, Z_GAP + 2), '#444444', [x, 2, 0]))
  }
  parts.push(
    painted(new THREE.BoxGeometry(legSpread * 0.85, 1, Z_GAP + 4), '#666666', [0, 0.5, 0]),
    painted(new THREE.CylinderGeometry(3.5, 3.5, Z_GAP + 4, 8), '#888888', [0, hubY, 0], [Math.PI / 2, 0, 0]),
    painted(new THREE.CylinderGeometry(5, 5, 1, 8), '#aaaaaa', [0, hubY, Z_GAP / 2 + 2.5], [Math.PI / 2, 0, 0]),
    painted(new THREE.CylinderGeometry(5, 5, 1, 8), '#aaaaaa', [0, hubY, -(Z_GAP / 2 + 2.5)], [Math.PI / 2, 0, 0]),
  )
  return mergePainted(parts)
}

/** Rims, spokes and gondola cross-bars, in the wheel's rotating frame (hub at origin). */
function buildWheel(radius: number, angles: number[]) {
  const parts = [
    painted(new THREE.TorusGeometry(radius, 1.5, 6, 36), '#cc3333', [0, 0, Z_GAP / 2]),
    painted(new THREE.TorusGeometry(radius, 1.5, 6, 36), '#cc3333', [0, 0, -Z_GAP / 2]),
  ]
  for (const a of angles) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    parts.push(
      painted(new THREE.CylinderGeometry(0.5, 0.5, radius, 4), '#999999', [c * radius * 0.5, s * radius * 0.5, 0], [0, 0, a + Math.PI / 2]),
      painted(new THREE.CylinderGeometry(0.8, 0.8, Z_GAP + 2, 4), '#777777', [c * radius, s * radius, 0], [Math.PI / 2, 0, 0]),
    )
  }
  return mergePainted(parts)
}

/** One gondola hanging from its mount point at the origin: arms + roof (frame) and cabin (tinted). */
function buildGondola() {
  return {
    frame: mergePainted([
      painted(new THREE.CylinderGeometry(0.3, 0.3, 6, 4), '#666666', [-2.5, -5, 0]),
      painted(new THREE.CylinderGeometry(0.3, 0.3, 6, 4), '#666666', [2.5, -5, 0]),
      painted(new THREE.BoxGeometry(8, 0.8, 6), '#dddddd', [0, -8, 0]),
    ]),
    cabin: new THREE.BoxGeometry(7, 6, 5).translate(0, -11.5, 0),
  }
}

/**
 * Animated Ferris wheel with proper A-frame supports, thin spokes, and
 * gondolas that hang downward. Four draw calls: the static frame, the rotating
 * wheel, and two InstancedMeshes for the gondolas (moved each frame).
 */
export default function FerrisWheel({
  position = [0, 0, 0],
  radius = 80,
  gondolaCount = 12,
}: FerrisWheelProps) {
  const wheelRef = useRef<THREE.Group>(null)
  const gondolaFrames = useRef<THREE.InstancedMesh>(null)
  const gondolaCabins = useRef<THREE.InstancedMesh>(null)
  const hubY = radius + 10

  const angles = useMemo(
    () => Array.from({ length: gondolaCount }, (_, i) => (i / gondolaCount) * Math.PI * 2),
    [gondolaCount],
  )

  const assets = useMemo(() => {
    const gondola = buildGondola()
    return {
      frame: buildFrame(radius),
      wheel: buildWheel(radius, angles),
      gondolaFrame: gondola.frame,
      cabin: gondola.cabin,
      painted: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true }),
      tinted: new THREE.MeshPhongMaterial({ flatShading: true }),
    }
  }, [radius, angles])

  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])

  /** Gondolas sit on the rim at their angle + the wheel's, always upright. */
  const placeGondolas = useCallback(
    (wheelAngle: number) => {
      const frames = gondolaFrames.current
      const cabins = gondolaCabins.current
      if (!frames || !cabins) return
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i] + wheelAngle
        _m.makeTranslation(Math.cos(a) * radius, hubY + Math.sin(a) * radius, 0)
        frames.setMatrixAt(i, _m)
        cabins.setMatrixAt(i, _m)
      }
      frames.instanceMatrix.needsUpdate = true
      cabins.instanceMatrix.needsUpdate = true
    },
    [angles, radius, hubY],
  )

  const setCabins = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      gondolaCabins.current = mesh
      if (!mesh) return
      for (let i = 0; i < angles.length; i++) mesh.setColorAt(i, _c.set(GONDOLA_COLORS[i % GONDOLA_COLORS.length]))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      placeGondolas(wheelRef.current?.rotation.z ?? 0)
      // The gondolas only ever move around the rim, so one sphere bounds them for good.
      mesh.computeBoundingSphere()
      gondolaFrames.current?.computeBoundingSphere()
    },
    [angles, placeGondolas],
  )

  useFrame((_, delta) => {
    const wheel = wheelRef.current
    if (!wheel) return
    wheel.rotation.z += ROTATION_SPEED * delta
    placeGondolas(wheel.rotation.z)
  })

  return (
    <group position={position}>
      <mesh geometry={assets.frame} material={assets.painted} />
      <group ref={wheelRef} position={[0, hubY, 0]}>
        <mesh geometry={assets.wheel} material={assets.painted} />
      </group>
      {/* Gondolas live in the wheel's parent frame so they never rotate. */}
      <instancedMesh ref={gondolaFrames} args={[assets.gondolaFrame, assets.painted, angles.length]} />
      <instancedMesh ref={setCabins} args={[assets.cabin, assets.tinted, angles.length]} />
    </group>
  )
}
