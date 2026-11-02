import { useCallback, useMemo } from 'react'
import type * as THREE from 'three'
import { type YawPlacement, yawScaleMatrix } from './yawScaleMatrix'

type Instances =
  | { matrices: readonly THREE.Matrix4[]; placements?: never }
  | { placements: readonly YawPlacement[]; matrices?: never }

/** An InstancedMesh whose matrices (and optional colours) are set once on mount. */
export default function StaticInstances({
  matrices,
  placements,
  colors,
  geometry,
  material,
  renderOrder = 0,
}: Instances & {
  colors?: readonly THREE.Color[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  renderOrder?: number
}) {
  const list = useMemo(
    () => matrices ?? placements?.map((p) => yawScaleMatrix(p, p.yaw, p.scale)) ?? [],
    [matrices, placements],
  )
  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      list.forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        if (colors) mesh.setColorAt(i, colors[i])
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [list, colors],
  )
  if (list.length === 0) return null
  return <instancedMesh ref={setRef} args={[geometry, material, list.length]} renderOrder={renderOrder} />
}
