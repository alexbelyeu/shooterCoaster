import { useMemo, useCallback } from 'react'
import * as THREE from 'three'
import type { TrackCurve } from './curves/TrackCurve'

interface TrackMeshProps {
  curve: TrackCurve
  segments?: number
  color1?: [number, number, number]
  color2?: [number, number, number]
}

/**
 * Port of mrdoob's RollerCoaster.js BufferGeometry extrusion.
 * Generates track rails with vertex colors.
 */
function buildTrackGeometry(
  curve: TrackCurve,
  segments: number,
  color1: [number, number, number],
  color2: [number, number, number],
): THREE.BufferGeometry {
  const vertices: number[] = []
  const normals: number[] = []
  const colors: number[] = []

  const up = new THREE.Vector3(0, 1, 0)
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()

  const quaternion = new THREE.Quaternion()
  const prevQuaternion = new THREE.Quaternion()
  prevQuaternion.setFromAxisAngle(up, Math.PI / 2)

  const point = new THREE.Vector3()
  const prevPoint = new THREE.Vector3()
  prevPoint.copy(curve.getPointAt(0))

  // Cross-tie shape (the flat steps between rails)
  const step = [
    new THREE.Vector3(-2.25, 0, 0),
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(0, -1.75, 0),
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(2.25, 0, 0),
    new THREE.Vector3(0, -1.75, 0),
  ]

  // Tube cross-sections
  const PI2 = Math.PI * 2
  const tube1: THREE.Vector3[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * PI2
    tube1.push(new THREE.Vector3(Math.sin(angle) * 0.6, Math.cos(angle) * 0.6, 0))
  }
  const tube2: THREE.Vector3[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * PI2
    tube2.push(new THREE.Vector3(Math.sin(angle) * 0.25, Math.cos(angle) * 0.25, 0))
  }

  const vector = new THREE.Vector3()
  const normal = new THREE.Vector3()

  function drawShape(shape: THREE.Vector3[], color: [number, number, number]) {
    normal.set(0, 0, -1).applyQuaternion(quaternion)
    for (let j = 0; j < shape.length; j++) {
      vector.copy(shape[j]).applyQuaternion(quaternion).add(point)
      vertices.push(vector.x, vector.y, vector.z)
      normals.push(normal.x, normal.y, normal.z)
      colors.push(color[0], color[1], color[2])
    }
    normal.set(0, 0, 1).applyQuaternion(quaternion)
    for (let j = shape.length - 1; j >= 0; j--) {
      vector.copy(shape[j]).applyQuaternion(quaternion).add(point)
      vertices.push(vector.x, vector.y, vector.z)
      normals.push(normal.x, normal.y, normal.z)
      colors.push(color[0], color[1], color[2])
    }
  }

  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const v3 = new THREE.Vector3()
  const v4 = new THREE.Vector3()
  const n1 = new THREE.Vector3()
  const n2 = new THREE.Vector3()
  const n3 = new THREE.Vector3()
  const n4 = new THREE.Vector3()

  function extrudeShape(
    shape: THREE.Vector3[],
    offset: THREE.Vector3,
    color: [number, number, number],
  ) {
    for (let j = 0; j < shape.length; j++) {
      const p1 = shape[j]
      const p2 = shape[(j + 1) % shape.length]

      v1.copy(p1).add(offset).applyQuaternion(quaternion).add(point)
      v2.copy(p2).add(offset).applyQuaternion(quaternion).add(point)
      v3.copy(p2).add(offset).applyQuaternion(prevQuaternion).add(prevPoint)
      v4.copy(p1).add(offset).applyQuaternion(prevQuaternion).add(prevPoint)

      vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v4.x, v4.y, v4.z)
      vertices.push(v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v4.x, v4.y, v4.z)

      n1.copy(p1).applyQuaternion(quaternion).normalize()
      n2.copy(p2).applyQuaternion(quaternion).normalize()
      n3.copy(p2).applyQuaternion(prevQuaternion).normalize()
      n4.copy(p1).applyQuaternion(prevQuaternion).normalize()

      normals.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n4.x, n4.y, n4.z)
      normals.push(n2.x, n2.y, n2.z, n3.x, n3.y, n3.z, n4.x, n4.y, n4.z)

      for (let k = 0; k < 6; k++) {
        colors.push(color[0], color[1], color[2])
      }
    }
  }

  const offset = new THREE.Vector3()

  for (let i = 1; i <= segments; i++) {
    point.copy(curve.getPointAt(i / segments))

    up.set(0, 1, 0)
    forward.subVectors(point, prevPoint).normalize()
    right.crossVectors(up, forward).normalize()
    up.crossVectors(forward, right)

    const angle = Math.atan2(forward.x, forward.z)
    quaternion.setFromAxisAngle(up, angle)

    if (i % 2 === 0) {
      drawShape(step, color2)
    }

    extrudeShape(tube1, offset.set(0, -1.25, 0), color2)
    extrudeShape(tube2, offset.set(2, 0, 0), color1)
    extrudeShape(tube2, offset.set(-2, 0, 0), color1)

    prevPoint.copy(point)
    prevQuaternion.copy(quaternion)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geometry
}

/** Generate support pillar positions along the track */
function generatePillarPositions(
  curve: TrackCurve,
  count: number,
): { x: number; y: number; z: number; height: number }[] {
  const pillars: { x: number; y: number; z: number; height: number }[] = []

  for (let i = 0; i < count; i++) {
    const t = i / count
    const point = curve.getPointAt(t)
    const height = point.y
    // Only place pillars where track is above ground level
    if (height > 5) {
      pillars.push({
        x: point.x,
        y: 0,
        z: point.z,
        height,
      })
    }
  }

  return pillars
}

function TrackPillars({ curve }: { curve: TrackCurve }) {
  const pillars = useMemo(() => generatePillarPositions(curve, 50), [curve])

  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      const mat = new THREE.Matrix4()
      const scale = new THREE.Vector3()

      for (let i = 0; i < pillars.length; i++) {
        const p = pillars[i]
        scale.set(1, p.height, 1)
        mat.makeTranslation(p.x, p.height / 2, p.z)
        mat.scale(scale)
        mesh.setMatrixAt(i, mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [pillars],
  )

  if (pillars.length === 0) return null

  return (
    <instancedMesh ref={setRef} args={[undefined, undefined, pillars.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.8, 1.2, 1, 6]} />
      <meshStandardMaterial color="#666666" roughness={0.7} metalness={0.3} />
    </instancedMesh>
  )
}

export default function TrackMesh({
  curve,
  segments = 1000,
  color1 = [1, 1, 1],
  color2 = [1, 1, 0],
}: TrackMeshProps) {
  const geometry = useMemo(
    () => buildTrackGeometry(curve, segments, color1, color2),
    [curve, segments, color1, color2],
  )

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.6} metalness={0.2} />
      </mesh>
      <TrackPillars curve={curve} />
    </>
  )
}
