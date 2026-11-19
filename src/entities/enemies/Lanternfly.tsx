import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import {
  LANTERNFLY_BODY_GEO, LANTERNFLY_FOREWING_GEOS, LANTERNFLY_FOREWING_PIVOT, LANTERNFLY_HINDWING_GEOS, LANTERNFLY_HINDWING_PIVOT, LANTERNFLY_MAT,
} from './SharedEnemyAssets'
import { HOP, hopRoute, newHopPose } from './hopGlideMotion'
import { hopPose } from './hopGlideMotion.hot'
import { freeWallSlot, wallNormal, wallPoint } from '@/entities/spawning/enemyPlacement'
import { hashString } from '@/utils/rng'

const LANTERNFLY_SCALE = 4
/** Each wing's swing out in the wall's plane, its roll (a tent over the back when folded) and the hindwing's fan. */
const FOLDED = { foreSwing: 0.06, foreRoll: 0.5, hindSwing: -0.05, hindRoll: 0.45, hindFan: 0.45 }
const OPEN = { foreSwing: 1.45, foreRoll: 0.1, hindSwing: 0.55, hindRoll: 0.05, hindFan: 1 }
const SIDES = [1, -1] as const
// The folded pose, built once: R3F compares props by reference, so an Euler made per render would be copied back
// onto the wings on any re-render (the pause), over the pose `updatePosition` set (#577).
const FOLDED_FORE = SIDES.map((s) => new THREE.Euler(0, s * FOLDED.foreRoll, s * FOLDED.foreSwing, 'ZYX'))
const FOLDED_HIND = SIDES.map((s) => new THREE.Euler(0, s * FOLDED.hindRoll, s * FOLDED.hindSwing, 'ZYX'))
const FOLDED_HIND_SCALE: [number, number, number] = [FOLDED.hindFan, 1, 1]

const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** A spotted lanternfly (#516): lands on its wall, sits, crawls, and hops and glides about it (`hopGlideMotion.ts`), flashing its red hindwings. */
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
  const forewings = useRef<(THREE.Group | null)[]>([null, null])
  const hindwings = useRef<(THREE.Group | null)[]>([null, null])

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number) => {
      startedAt.current ??= time
      hopPose(route, time - startedAt.current, pose)
      wallPoint(slot.wall, pose.u, pose.v, pose.off, mesh.position, normal)
      if (heading.current) heading.current.rotation.z = pose.heading
      const w = pose.wings
      for (let i = 0; i < 2; i++) {
        const s = SIDES[i]
        forewings.current[i]?.rotation.set(0, s * mix(FOLDED.foreRoll, OPEN.foreRoll, w), s * mix(FOLDED.foreSwing, OPEN.foreSwing, w))
        const hind = hindwings.current[i]
        if (hind) {
          hind.rotation.set(0, s * mix(FOLDED.hindRoll, OPEN.hindRoll, w), s * mix(FOLDED.hindSwing, OPEN.hindSwing, w))
          hind.scale.x = mix(FOLDED.hindFan, OPEN.hindFan, w)
        }
      }
    },
    [route, pose, slot, normal],
  )

  const [fx, fy, fz] = LANTERNFLY_FOREWING_PIVOT
  const [hx, hy, hz] = LANTERNFLY_HINDWING_PIVOT
  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group quaternion={onWall}>
        <group ref={heading} scale={LANTERNFLY_SCALE}>
          <mesh geometry={LANTERNFLY_BODY_GEO} material={LANTERNFLY_MAT} />
          {SIDES.map((s, i) => (
            <group key={s}>
              <group
                ref={(g) => { hindwings.current[i] = g }}
                position={[s * hx, hy, hz]}
                rotation={FOLDED_HIND[i]}
                scale={FOLDED_HIND_SCALE}
              >
                <mesh geometry={LANTERNFLY_HINDWING_GEOS[i]} material={LANTERNFLY_MAT} />
              </group>
              <group
                ref={(g) => { forewings.current[i] = g }}
                position={[s * fx, fy, fz]}
                rotation={FOLDED_FORE[i]}
              >
                <mesh geometry={LANTERNFLY_FOREWING_GEOS[i]} material={LANTERNFLY_MAT} />
              </group>
            </group>
          ))}
        </group>
      </group>
    </EnemyBase>
  )
}
