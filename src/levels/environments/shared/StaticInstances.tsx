import { useCallback } from 'react'
import type * as THREE from 'three'

/** An InstancedMesh whose matrices (and optional colours) are set once on mount. */
export default function StaticInstances({
  matrices,
  colors,
  geometry,
  material,
  renderOrder = 0,
}: {
  matrices: readonly THREE.Matrix4[]
  colors?: readonly THREE.Color[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  renderOrder?: number
}) {
  const setRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return
      matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        if (colors) mesh.setColorAt(i, colors[i])
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    },
    [matrices, colors],
  )
  if (matrices.length === 0) return null
  return <instancedMesh ref={setRef} args={[geometry, material, matrices.length]} renderOrder={renderOrder} />
}
