import { useCallback, useContext, useRef } from 'react'
import * as THREE from 'three'
import EnemyBase, { type EnemyProps } from './EnemyBase'
import { useEnemyRandom } from './enemyRandom'
import { useSlipAway } from './useSlipAway'
import { SAND_BURROW } from './slipAway.hot'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { SCUTTLE_RADIUS } from '../spawning/enemyPlacement'
import {
  SCORPION_GEO, SCORPION_TAIL_GEO, SCORPION_TAIL_PIVOT,
  SCORPION_SHELL_MAT, SCORPION_TAIL_MAT,
} from './SharedEnemyAssets'

/**
 * Ground-crawling scorpion: dark chitin with amber jointed legs, in three draw
 * calls (merged shell, swaying tail, glowing stinger). Scuttles round a small loop through
 * where it was placed (#494: a straight crawl took it hundreds of units out of the view its
 * placement chose within seconds), following terrain height. On a dark section's floor (#937, level 2's passage) it
 * holds its spot between the rails and the wall instead, shuffling to and fro down the passage and facing the car.
 * One left too long once the rider has seen it burrows back into the sand, unscored (`SAND_BURROW`, #1059); never off the
 * passage's stone floor, which it holds while the car is in the dark.
 */
/** On a floor: how far it shuffles either way down the passage, and how far it turns either side of facing the car (radians). */
const FLOOR_SHUFFLE = 8
const FLOOR_SWAY = 0.3

export default function Scorpion(props: EnemyProps) {
  const { floor } = props
  const { moveAngle, turnRate } = useEnemyRandom(props.id, (rng) => ({
    moveAngle: rng() * Math.PI * 2,
    // 0.6–1.4 rad/s, either way round: a lap in 4.5–10 s at 12–28 units/s.
    turnRate: (0.6 + rng() * 0.8) * (rng() < 0.5 ? -1 : 1),
  }))
  const bodyRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const heightFn = useContext(TerrainContext)
  // The Tomb's floor is stone: one there holds its spot through the passage.
  const burrow = useSlipAway(floor ? undefined : SAND_BURROW)

  const updatePosition = useCallback(
    (mesh: THREE.Object3D, spawnPos: THREE.Vector3, time: number) => {
      let heading: number
      if (floor) {
        const along = Math.sin(time * 1.7 + moveAngle) * FLOOR_SHUFFLE
        mesh.position.x = spawnPos.x + Math.cos(floor.heading) * along
        mesh.position.z = spawnPos.z + Math.sin(floor.heading) * along
        mesh.position.y = floor.y + 5
        heading = floor.heading + Math.sin(time * 1.1 + moveAngle) * FLOOR_SWAY
      } else {
        // Turning at `turnRate`: the loop of SCUTTLE_RADIUS it traces passes through the spawn at heading = moveAngle.
        heading = moveAngle + turnRate * time
        const r = SCUTTLE_RADIUS * Math.sign(turnRate)
        mesh.position.x = spawnPos.x + r * (Math.sin(heading) - Math.sin(moveAngle))
        mesh.position.z = spawnPos.z - r * (Math.cos(heading) - Math.cos(moveAngle))
        mesh.position.y = heightFn(mesh.position.x, mesh.position.z) + 5
      }
      const sunk = burrow(mesh.position, time)
      if (sunk < 0) return 'escaped'
      mesh.position.y -= sunk
      if (bodyRef.current) bodyRef.current.rotation.y = -heading
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(time * 2.5) * 0.2
    },
    [moveAngle, turnRate, heightFn, floor, burrow],
  )

  return (
    <EnemyBase {...props} updatePosition={updatePosition}>
      <group ref={bodyRef} scale={[8, 8, 8]} rotation={[0, -moveAngle, 0]}>
        <mesh geometry={SCORPION_GEO} material={SCORPION_SHELL_MAT} />
        <mesh ref={tailRef} position={SCORPION_TAIL_PIVOT} geometry={SCORPION_TAIL_GEO} material={SCORPION_TAIL_MAT} />
      </group>
    </EnemyBase>
  )
}
