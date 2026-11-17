import { useCallback, useContext, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import {
  FIRE_IMP_ARMS_GEO, FIRE_IMP_BODY_GEO, FIRE_IMP_EYE_MAT, FIRE_IMP_EYES_GEO, FIRE_IMP_MAT,
  FIRE_IMP_RUMP, FIRE_IMP_SHOULDER, FIRE_IMP_TAIL_GEO,
} from './SharedEnemyAssets'

/** Hops a game second, its share of each hop in the air, and the hop's height (model units). */
const HOP_RATE = 1.8
const AIRBORNE = 0.75
const HOP_HEIGHT = 2.2
/** The arms' swing about the shoulders (radians, - = forward and up): at the top of a hop, and thrown up when hit. */
const ARMS_HOP = -1.2
const ARMS_FLINCH = -2.7

/**
 * A stocky, grinning gremlin (brief: docs/art/ENEMIES.md) turned to the rider, darting about in hops: it stretches
 * as it leaves the ground and squashes as it lands, its arms pumping and its tail whipping. Shot, it throws its arms up.
 */
export default function FireImp(props: EnemyProps) {
  const { moveSpeed, dirChangeInterval, heading, hopOffset, rng } = useEnemyRandom(props.id, (rng) => ({
    moveSpeed: 3 + rng() * 2, dirChangeInterval: 2 + rng() * 1, heading: rng() * Math.PI * 2, hopOffset: rng(), rng,
  }))
  const dirRef = useRef(heading)
  const lastDirChange = useRef(0)
  const modelRef = useRef<THREE.Group>(null)
  const hopRef = useRef<THREE.Group>(null)
  const armsRef = useRef<THREE.Mesh>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const heightFn = useContext(TerrainContext)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, _spawnPos: THREE.Vector3, time: number, delta: number) => {
      const dt = delta * 60

      // Sudden direction changes
      if (time - lastDirChange.current > dirChangeInterval) {
        dirRef.current += (rng() - 0.5) * Math.PI
        lastDirChange.current = time
      }

      mesh.position.x += Math.cos(dirRef.current) * moveSpeed * dt
      mesh.position.z += Math.sin(dirRef.current) * moveSpeed * dt
      mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 2

      const p = (time * HOP_RATE + hopOffset) % 1
      const air = p < AIRBORNE ? Math.sin((Math.PI * p) / AIRBORNE) : 0
      const land = p < AIRBORNE ? 0 : Math.sin((Math.PI * (p - AIRBORNE)) / (1 - AIRBORNE))
      // Stretched leaving the ground and coming down, round at the top; squashed on landing.
      const stretch = p < AIRBORNE ? 0.12 * Math.abs(Math.cos((Math.PI * p) / AIRBORNE)) : 0
      const hop = hopRef.current
      if (hop) {
        hop.position.y = HOP_HEIGHT * air
        hop.scale.set(1 - 0.5 * stretch + 0.16 * land, 1 + stretch - 0.24 * land, 1 - 0.5 * stretch + 0.16 * land)
        hop.rotation.x = 0.15 * air
      }
      if (armsRef.current) armsRef.current.rotation.x = ARMS_HOP * air + 0.3 * land
      if (tailRef.current) {
        tailRef.current.rotation.y = 0.55 * Math.sin(Math.PI * 2 * p * 2)
        tailRef.current.rotation.x = -0.3 * air + 0.25 * land
      }
    },
    [moveSpeed, dirChangeInterval, hopOffset, heightFn, rng],
  )

  const onHit = useCallback(() => {
    if (armsRef.current) armsRef.current.rotation.x = ARMS_FLINCH
    if (tailRef.current) tailRef.current.rotation.set(0.5, 0, 0)
  }, [])

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })

  return (
    <EnemyBase {...props} updatePosition={updatePosition} onHit={onHit}>
      <group ref={modelRef} scale={[8, 8, 8]}>
        <group ref={hopRef}>
          <mesh geometry={FIRE_IMP_BODY_GEO} material={FIRE_IMP_MAT} />
          <mesh geometry={FIRE_IMP_EYES_GEO} material={FIRE_IMP_EYE_MAT} />
          <mesh ref={armsRef} position={FIRE_IMP_SHOULDER} geometry={FIRE_IMP_ARMS_GEO} material={FIRE_IMP_MAT} />
          <mesh ref={tailRef} position={FIRE_IMP_RUMP} geometry={FIRE_IMP_TAIL_GEO} material={FIRE_IMP_MAT} />
        </group>
      </group>
    </EnemyBase>
  )
}
