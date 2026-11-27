import { useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { WADDLE_RATE } from './billboardBotMotion'
import { BOT_FLEET, BOT_GEO, BOT_HEIGHT, BOT_MAT } from './SharedEnemyAssets'
import { STREET_DROP } from './slipAway.hot'
import { useFleetSeat } from './useFleetSeat'
import { useSlipAway } from './useSlipAway'
import { streetAxis } from '@/levels/environments/biomes/city/cityLayout'

const SCALE = 8
const HALF_HEIGHT = (BOT_HEIGHT * SCALE) / 2
/** How far it marches up and down its street either way of its spot, and how fast (radians per game second). */
const MARCH = { reach: 16, rate: 0.45 }

/**
 * A billboard bot (brief: docs/art/ENEMIES.md, #963): turned to the rider, it waddles up and down its street. One left
 * too long once the rider has seen it drops through the street, unscored (`STREET_DROP`, #1059).
 */
export default function BillboardBot(props: EnemyProps) {
  const { phase, marchPhase } = useEnemyRandom(props.id, (rng) => ({
    phase: rng() * Math.PI * 2,
    marchPhase: rng() * Math.PI * 2,
  }))
  const modelRef = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const axis = streetAxis(props.spawnPosition.x, props.spawnPosition.z)
  const drop = useSlipAway(STREET_DROP)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      const dropped = drop(mesh.position, time)
      if (dropped < 0) return 'escaped'
      const march = Math.sin(time * MARCH.rate + marchPhase) * MARCH.reach
      mesh.position.x = spawnPos.x + (axis === 'x' ? march : 0)
      mesh.position.z = spawnPos.z + (axis === 'z' ? march : 0)
      const step = time * WADDLE_RATE + phase
      mesh.position.y = spawnPos.y + HALF_HEIGHT + Math.abs(Math.sin(step)) * 2 - dropped
      const model = modelRef.current
      if (model) model.rotation.z = Math.cos(step) * 0.12
    },
    [phase, marchPhase, axis, drop],
  )

  useFrame(() => {
    const model = modelRef.current
    if (!model?.parent) return
    model.rotation.y = Math.atan2(camera.position.x - model.parent.position.x, camera.position.z - model.parent.position.z)
  })
  const meshRef = useFleetSeat(BOT_FLEET)

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      {/* Pivots on its feet, so the waddle rocks it foot to foot */}
      <group ref={modelRef} position={[0, -HALF_HEIGHT, 0]}>
        <mesh ref={meshRef} geometry={BOT_GEO} material={BOT_MAT} scale={[SCALE, SCALE, SCALE]} />
      </group>
    </EnemyBase>
  )
}
