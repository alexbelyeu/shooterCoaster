import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import type { BossType, LevelConfig } from '@/types/level'
import { e2eBoss, isE2E, type E2EBossStage } from '@/testing/e2eHook'
import { BOSS_SPECS } from './bossSpecs'
import type { BossProps } from './BossBase'
import GoldenBlimp from './GoldenBlimp'

const BOSS_COMPONENTS: Record<BossType, React.ComponentType<BossProps>> = {
  goldenBlimp: GoldenBlimp,
}

type Stage = Exclude<E2EBossStage, 'none' | 'defeated'>

interface BossSpawnerProps {
  boss: NonNullable<LevelConfig['boss']>
  timerSeconds: number
}

/** Tell and arrival run on GameTimer's `timeRemaining`, which holds through pauses and the countdown. */
export default function BossSpawner({ boss, timerSeconds }: BossSpawnerProps) {
  const spec = BOSS_SPECS[boss.type]
  const [stage, setStage] = useState<Stage>('waiting')
  const stageRef = useRef<Stage>('waiting')

  const advance = useCallback((next: Stage) => {
    stageRef.current = next
    setStage(next)
    if (isE2E) e2eBoss.stage = next
  }, [])

  useEffect(() => {
    if (isE2E) {
      e2eBoss.stage = 'waiting'
      e2eBoss.summon = false
    }
    return () => {
      if (isE2E) e2eBoss.stage = 'none'
    }
  }, [])

  useFrame(() => {
    const s = useGameStore.getState()
    if (s.phase !== 'playing') return
    const summoned = isE2E && e2eBoss.summon
    if (summoned) e2eBoss.summon = false
    // Read live: the first playing frame already has this run's reset timer (GameTimer's layout effect).
    const elapsed = timerSeconds - s.timeRemaining
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

  if (stage === 'done') return null
  const Boss = BOSS_COMPONENTS[boss.type]
  return <Boss id={boss.type} active={stage === 'active'} onDone={onDone} />
}
