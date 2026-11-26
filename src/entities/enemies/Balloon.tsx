import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { BALLOON_FLIGHT, balloonEscaped, balloonLift, balloonSway } from './balloonMotion.hot'
import {
  BALLOON_GEO, BALLOON_STRING_GEO,
  BALLOON_BODY_MATS, BALLOON_STRING_MAT,
  BALLOON_COLOR_COUNT,
} from './SharedEnemyAssets'

const _look = new THREE.Vector3()
const _to = new THREE.Vector3()

/** Within `near` of the rider and in front of its look: the rider has seen it. */
function inSight(p: THREE.Vector3, camera: THREE.Camera): boolean {
  _to.subVectors(p, camera.position)
  const d = _to.length()
  return d < BALLOON_FLIGHT.near && _to.dot(camera.getWorldDirection(_look)) > BALLOON_FLIGHT.seenCos * d
}

/**
 * Realistic balloon: teardrop body (scaled sphere), hanging string, varied bright colors, slight specular shine.
 * Sways on the wind and floats up; one left too long slips away (`balloonMotion.hot.ts`), unscored.
 */
export default function Balloon(props: EnemyProps) {
  const { colorIndex, bobPhase, swayPhase } = useEnemyRandom(props.id, (rng) => ({
    colorIndex: Math.floor(rng() * BALLOON_COLOR_COUNT), bobPhase: rng() * Math.PI * 2, swayPhase: rng() * Math.PI * 2,
  }))
  const holdSlot = props.motion?.kind === 'hold'
  const camera = useThree((s) => s.camera)
  const clock = useRef({ settledAt: -1, nearAt: -1 })

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const c = clock.current
      if (c.settledAt < 0) c.settledAt = time
      if (c.nearAt < 0 && inSight(mesh.position, camera)) c.nearAt = time
      const age = time - c.settledAt
      const near = c.nearAt < 0 ? 0 : time - c.nearAt
      if (balloonEscaped(near)) return 'escaped'
      mesh.position.x = spawnPos.x + balloonSway(age, swayPhase)
      const lift = balloonLift(near)
      if (holdSlot) {
        mesh.position.y = spawnPos.y + Math.sin(time * 1.6 + bobPhase) * 6 + lift
        return
      }
      mesh.position.y = spawnPos.y + BALLOON_FLIGHT.rise * age + lift
      mesh.position.z = spawnPos.z + BALLOON_FLIGHT.drift * age
    },
    [holdSlot, bobPhase, swayPhase, camera],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group>
        {/* Teardrop body + knot */}
        <mesh geometry={BALLOON_GEO} material={BALLOON_BODY_MATS[colorIndex]} />

        {/* String hanging below */}
        <mesh position={[0, -65, 0]} geometry={BALLOON_STRING_GEO} material={BALLOON_STRING_MAT} />
      </group>
    </EnemyBase>
  )
}
