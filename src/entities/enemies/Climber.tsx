import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  CLIMBER_ARM_GEO, CLIMBER_BODY_GEO, CLIMBER_HIP, CLIMBER_LEGS_GEO, CLIMBER_MARKER_GEO, CLIMBER_MARKER_MAT, CLIMBER_MARKER_Y, CLIMBER_MAT,
  CLIMBER_SHOULDER,
} from './SharedEnemyAssets'
import { climbPose, climbRoute, newClimbPose } from './climbMotion'
import { WALL_STANDOFF, wallNormal, wallPoint, type WallSlot } from '@/entities/spawning/enemyPlacement'
import type { WallSurface } from '@/types/level'
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
/** A bystander climbs at a calm pace, so it stays on the wall long enough (~15 s) to be seen and spared. */
const BYSTANDER_PACE = 0.5
/** The friend marker bobs over the helmet. */
const MARKER_BOB = { amplitude: 0.25, rate: 3.5 }

/** Off a level (the turntable): a wall of its own, facing +z, behind where it was mounted. */
function wallAt(p: THREE.Vector3): WallSlot {
  const width = 200
  const wall: WallSurface = {
    id: 'free',
    origin: { x: p.x - width / 2, y: p.y, z: p.z - WALL_STANDOFF },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    width,
    height: 10_000,
  }
  return { wall, u: width / 2, v: 0, seed: 0 }
}

/** A toy climber figurine (#453), a bystander (#518): enters at the foot of its wall (no fly-in) and climbs `climbMotion.ts`'s route. */
export default function Climber(props: EnemyProps) {
  const { id, spawnPosition } = props
  const pace = props.bystander ? BYSTANDER_PACE : 1
  // Mount-time only, like EnemyBase's start.
  const [slot] = useState(() => props.wall ?? wallAt(spawnPosition))
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
  const marker = useRef<THREE.Mesh>(null)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      climbPose(route, (time - startedAt.current) * pace, pose)
      if (pose.escaped) return 'escaped' as const
      wallPoint(slot.wall, pose.u, pose.v, WALL_STANDOFF, mesh.position, normal)
      setArm(leftArm.current, pose.arms[0], 1)
      setArm(rightArm.current, pose.arms[1], -1)
      if (legs.current) legs.current.rotation.z = pose.legs * LEG_ROLL
      if (marker.current) marker.current.position.y = CLIMBER_MARKER_Y + Math.sin(time * MARKER_BOB.rate) * MARKER_BOB.amplitude
    },
    [route, pose, slot, normal, pace],
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
        <mesh ref={marker} geometry={CLIMBER_MARKER_GEO} material={CLIMBER_MARKER_MAT} position={[0, CLIMBER_MARKER_Y, -0.4]} scale={1.4} />
      </group>
    </EnemyBase>
  )
}
