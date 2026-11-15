import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { CLIMBER_ARM_GEO, CLIMBER_BODY_GEO, CLIMBER_HIP, CLIMBER_LEGS_GEO, CLIMBER_MAT, CLIMBER_SHOULDER } from './SharedEnemyAssets'
import { climbPose, climbRoute, newClimbPose } from './climbMotion'
import { WALL_STANDOFF, freeWallSlot, wallNormal, wallPoint } from '@/entities/spawning/enemyPlacement'
import { hashString } from '@/utils/rng'

const CLIMBER_SCALE = 8
/** An arm hangs along -y at rest; low on the wall it is out to the side at chest height, at full reach overhead. */
const ARM_LOW = { pitch: -1.3, splay: 0.7 }
const ARM_HIGH = { pitch: -2.95, splay: 0.35 }

function setArm(arm: THREE.Object3D | null, reach: number, side: 1 | -1) {
  if (!arm) return
  arm.rotation.x = ARM_LOW.pitch + (ARM_HIGH.pitch - ARM_LOW.pitch) * reach
  arm.rotation.z = side * (ARM_LOW.splay + (ARM_HIGH.splay - ARM_LOW.splay) * reach)
}
const LEG_ROLL = 0.22
const LEG_PITCH = -0.25

/** A toy climber figurine (#453): enters at the foot of its wall (no fly-in) and climbs `climbMotion.ts`'s route. */
export default function Climber(props: EnemyProps) {
  const { id, spawnPosition } = props
  // Mount-time only, like EnemyBase's start.
  const [slot] = useState(() => props.wall ?? freeWallSlot(spawnPosition, WALL_STANDOFF))
  const route = useMemo(() => climbRoute(slot, slot.wall, slot.seed || hashString(id)), [slot, id])
  const normal = useMemo(() => wallNormal(slot.wall), [slot])
  // Faces into the wall: its +z along -normal, its +y up the wall.
  const facing = useMemo(() => {
    const { right, up } = slot.wall
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(-right.x, -right.y, -right.z),
      new THREE.Vector3(up.x, up.y, up.z),
      new THREE.Vector3(-normal.x, -normal.y, -normal.z),
    )
    return new THREE.Quaternion().setFromRotationMatrix(basis)
  }, [slot, normal])
  const pose = useRef(newClimbPose()).current
  const startedAt = useRef<number | null>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      climbPose(route, time - startedAt.current, pose)
      if (pose.escaped) return 'escaped' as const
      wallPoint(slot.wall, pose.u, pose.v, WALL_STANDOFF, mesh.position, normal)
      setArm(leftArm.current, pose.arms[0], 1)
      setArm(rightArm.current, pose.arms[1], -1)
      if (legs.current) legs.current.rotation.z = pose.legs * LEG_ROLL
    },
    [route, pose, slot, normal],
  )

  const [sx, sy, sz] = CLIMBER_SHOULDER
  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group quaternion={facing} scale={CLIMBER_SCALE}>
        <mesh geometry={CLIMBER_BODY_GEO} material={CLIMBER_MAT} />
        <group ref={leftArm} position={[sx, sy, sz]} rotation={[ARM_LOW.pitch, 0, ARM_LOW.splay]}>
          <mesh geometry={CLIMBER_ARM_GEO} material={CLIMBER_MAT} />
        </group>
        <group ref={rightArm} position={[-sx, sy, sz]} rotation={[ARM_LOW.pitch, 0, -ARM_LOW.splay]}>
          <mesh geometry={CLIMBER_ARM_GEO} material={CLIMBER_MAT} />
        </group>
        <group ref={legs} position={CLIMBER_HIP} rotation={[LEG_PITCH, 0, 0]}>
          <mesh geometry={CLIMBER_LEGS_GEO} material={CLIMBER_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
