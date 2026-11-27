import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { SEA_DIVE } from './seaDive.hot'
import { SHARK_BODY_GEO, SHARK_MAT, SHARK_TAIL_GEO, SHARK_TAIL_ROOT } from './SharedEnemyAssets'
import { useSeaDive } from './useSeaDive'

/** Tail beats (radians of swim phase per game second) and the sweep's amplitude; the body yaws against it. */
const SWIM_RATE = 4.5
const TAIL_SWEEP = 0.42
const BODY_COUNTER = 0.08
/** Roll into the turn at full sideways speed, as seen by the rider. */
const TURN_ROLL = 0.45

/**
 * A toy shark (brief: docs/art/ENEMIES.md) in two draw calls, body and tail, nose to the rider, circling beside the
 * track: its tail sweeps, the body swaying against it, and it rolls into its turn. Shot, it flinches nose-up; left too
 * long, it dives (`useSeaDive`).
 */
export default function Shark(props: EnemyProps) {
  // Its circle through the spawn point, placed clear of the rails, the stacks and the shore (`spawning/swimOrbit.ts`, #922);
  // a random one where nothing placed it (the turntable).
  const drawn = useEnemyRandom(props.id, (rng) => ({
    radius: 25 + rng() * 35,
    rate: (0.4 + rng() * 0.4) * (rng() < 0.5 ? -1 : 1),
    phase: rng() * Math.PI * 2,
    swim: rng() * Math.PI * 2,
  }))
  const placed = props.orbit
  const orbit = useMemo(() => (placed ? { ...drawn, ...placed } : drawn), [drawn, placed])
  const startTime = useRef<number | null>(null)
  // The direction it swims, (sin, cos) of its heading in world x / z.
  const heading = useRef({ x: 0, z: 1 })
  const modelRef = useRef<THREE.Group>(null)
  const rigRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const dive = useSeaDive('shark', props.onEscape !== undefined)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      startTime.current ??= time
      const { radius, rate, phase, swim } = orbit
      const a = phase + rate * (time - startTime.current)
      mesh.position.x = spawnPos.x + radius * (Math.cos(a) - Math.cos(phase))
      mesh.position.z = spawnPos.z + radius * (Math.sin(a) - Math.sin(phase))
      const sunk = dive(mesh, time)
      if (sunk >= 1) return 'escaped' as const
      mesh.position.y = 2 - sunk * SEA_DIVE.depth
      const dir = Math.sign(rate)
      heading.current.x = -Math.sin(a) * dir
      heading.current.z = Math.cos(a) * dir

      const beat = Math.sin(time * SWIM_RATE + swim)
      if (tailRef.current) tailRef.current.rotation.y = TAIL_SWEEP * beat
      if (rigRef.current) {
        rigRef.current.rotation.y = -BODY_COUNTER * beat
        rigRef.current.rotation.x = 0.04 * Math.sin(time * SWIM_RATE * 0.5 + swim)
      }
    },
    [orbit, dive],
  )

  const onHit = useCallback(() => {
    if (rigRef.current) rigRef.current.rotation.set(-0.45, 0, 0.3)
    if (tailRef.current) tailRef.current.rotation.y = 0.8
  }, [])

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    const yaw = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
    model.rotation.y = yaw
    // Its heading across the rider's view (the model's +x): it banks that way.
    const across = heading.current.x * Math.cos(yaw) - heading.current.z * Math.sin(yaw)
    model.rotation.z = -TURN_ROLL * across
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition} onHit={onHit}>
      <group ref={modelRef} scale={10}>
        <group ref={rigRef}>
          <mesh geometry={SHARK_BODY_GEO} material={SHARK_MAT} />
          <mesh ref={tailRef} position={SHARK_TAIL_ROOT} geometry={SHARK_TAIL_GEO} material={SHARK_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
