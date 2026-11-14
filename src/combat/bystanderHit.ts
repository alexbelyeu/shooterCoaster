/** A shot bystander (#518): the penalty, the combo, a chalk puff and the bus event the popup, sound and hint follow. */
import type * as THREE from 'three'
import type { EnemyType } from '@/types/level'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { BYSTANDER_PENALTY } from '@/levels/scoring'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { DEATH_STYLES } from '@/effects/deathStyles'
import { BYSTANDER_HIT_EVENT, type BystanderHitEvent } from './bystanders'
import { breakCombo } from './comboRuntime'
import { CAMERA_TRAUMA_EVENT } from './screenShake'

/** A small nudge, under a kill's. */
const NUDGE: [number, number] = [0.18, 220]

/** Once per bystander `id` (the store keeps who was hit); a second hit does nothing. */
export function hitBystander(id: string, type: EnemyType, position: THREE.Vector3): void {
  if (!useGameStore.getState().hitBystander(id, BYSTANDER_PENALTY)) return
  breakCombo()
  getExplosionPool()?.explode(position, DEATH_STYLES[type])
  const event: BystanderHitEvent = { type, position: { x: position.x, y: position.y, z: position.z }, penalty: BYSTANDER_PENALTY }
  eventBus.emit(BYSTANDER_HIT_EVENT, event)
  eventBus.emit(CAMERA_TRAUMA_EVENT, NUDGE[0], NUDGE[1])
}
