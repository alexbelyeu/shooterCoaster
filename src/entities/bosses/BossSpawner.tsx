import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import type { LevelConfig } from '@/types/level'
import { e2eBoss, isE2E, type E2EBossStage } from '@/testing/e2eState'
import { BOSS_SPECS } from './bossSpecs'
import { useWorld } from '@/levels/environments/worlds'
import type { ArcTable } from '@/track/arcLength'
import type { HeightFunction } from '@/utils/terrainNoise'
import { RUN_SECONDS } from '@/levels/pacing'

type Stage = Exclude<E2EBossStage, 'none' | 'defeated'>

interface BossSpawnerProps {
  boss: NonNullable<LevelConfig['boss']>
  track: ArcTable
  groundFn: HeightFunction
}

/**
 * Tell and arrival run on GameTimer's `timeRemaining`, which holds through pauses and the countdown. The boss's
 * component comes from the level's world chunk (#862).
 */
export default function BossSpawner({ boss, track, groundFn }: BossSpawnerProps) {
  const Boss = useWorld().bosses[boss.type]
  const spec = BOSS_SPECS[boss.type]
  const [stage, setStage] = useState<Stage>('waiting')
  const stageRef = useRef<Stage>('waiting')
  // EnemySpawner remounts this per run, a frame or more after the run starts: only this run's summon is ours.
  const [runId] = useState(() => useGameStore.getState().runId)

  const advance = useCallback((next: Stage) => {
    stageRef.current = next
    setStage(next)
    if (isE2E) e2eBoss.stage = next
  }, [])

  useEffect(() => {
    if (isE2E) e2eBoss.stage = 'waiting'
    return () => {
      if (isE2E) e2eBoss.stage = 'none'
    }
  }, [])

  useFrame(() => {
    const s = useGameStore.getState()
    if (s.phase !== 'playing') return
    const summoned = isE2E && e2eBoss.summon === runId
    if (summoned) e2eBoss.summon = null
    // Read live: the first playing frame already has this run's reset timer (GameTimer's layout effect).
    const elapsed = RUN_SECONDS - s.timeRemaining
    if (stageRef.current === 'waiting' && (summoned || elapsed >= boss.at - spec.tell.seconds)) {
      advance('incoming')
      eventBus.emit('wave:incoming', spec.tell.label)
      if (!summoned) return
    }
    if (stageRef.current === 'incoming' && (summoned || elapsed >= boss.at)) advance('active')
  })

  const onDone = useCallback(() => {
    if (stageRef.current !== 'done') advance('done')
  }, [advance])

  if (stage === 'done' || !Boss) return null
  return <Boss
      id={boss.type}
      active={stage === 'active'}
      incoming={stage === 'incoming'}
      onDone={onDone}
      track={track}
      groundFn={groundFn}
    />
}
