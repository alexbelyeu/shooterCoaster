import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { setFlashMaterial } from './hitFlash'
import { LANTERNFLY_GEO, createLanternflyFlashMaterial, createLanternflyMaterial } from './SharedEnemyAssets'
import { HOP, hopRoute, newHopPose } from './hopGlideMotion'
import { hopPose } from './hopGlideMotion.hot'
import { freeWallSlot, wallNormal, wallPoint } from '@/entities/spawning/enemyPlacement'
import { hashString } from '@/utils/rng'

// Reads on the gym's walls from the ride, on a phone (#665); HOP's distances and SWARM_SPACING scale with it.
const LANTERNFLY_SCALE = 7

/** A spotted lanternfly (#516) in one draw call (#632): lands on its wall, sits, crawls, and hops and glides about it (`hopGlideMotion.ts`), flashing its red hindwings, which open in its material's vertex shader. */
export default function Lanternfly(props: EnemyProps) {
  const { id, spawnPosition } = props
  // Mount-time only, like EnemyBase's start.
  const [slot] = useState(() => props.wall ?? freeWallSlot(spawnPosition, HOP.standoff))
  const route = useMemo(() => hopRoute(slot, slot.wall, slot.seed || hashString(id)), [slot, id])
  const normal = useMemo(() => wallNormal(slot.wall), [slot])
  // Lies on the wall: its +y up the wall, its back (+z) out along the normal.
  const onWall = useMemo(() => {
    const { right, up } = slot.wall
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(right.x, right.y, right.z),
      new THREE.Vector3(up.x, up.y, up.z),
      new THREE.Vector3(normal.x, normal.y, normal.z),
    )
    return new THREE.Quaternion().setFromRotationMatrix(basis)
  }, [slot, normal])
  const pose = useRef(newHopPose()).current
  const startedAt = useRef<number | null>(null)
  const heading = useRef<THREE.Group>(null)
  const wings = useMemo(() => ({ value: 0 }), [])
  const material = useMemo(() => createLanternflyMaterial(wings), [wings])
  const flashMaterial = useMemo(() => createLanternflyFlashMaterial(wings), [wings])
  useEffect(() => () => {
    material.dispose()
    flashMaterial.dispose()
  }, [material, flashMaterial])
  const tagFlash = useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) setFlashMaterial(mesh, flashMaterial)
  }, [flashMaterial])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      hopPose(route, time - startedAt.current, pose)
      wallPoint(slot.wall, pose.u, pose.v, pose.off, mesh.position, normal)
      if (heading.current) heading.current.rotation.z = pose.heading
      wings.value = pose.wings
    },
    [route, pose, slot, normal, wings],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group quaternion={onWall}>
        <group ref={heading} scale={LANTERNFLY_SCALE}>
          <mesh ref={tagFlash} geometry={LANTERNFLY_GEO} material={material} />
        </group>
      </group>
    </EnemyBase>
  )
}
