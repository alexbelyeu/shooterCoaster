import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import type { GamePhase } from '@/types/game'
import { startMusic, stopMusic, setMusicIntensity } from '@/audio/MusicManager'
import {
  disposeSFX, playBossDefeat, playBossHit, playBossStinger, playComboBreak, playFireworkPop, playFireworkWhistle, playHitTick,
  playWaveStinger, prepareLevelSFX,
} from '@/audio/SFXManager'
import { setMusicDucked, setPauseMix, syncVolumes } from '@/audio/AudioEngine'
import { MUSIC_ENGINE, withScrim } from '@/audio/musicEngine'
import { eventBus } from '@/core/EventBus'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { FIREWORK_BURST_EVENT, FIREWORK_LAUNCH_EVENT } from '@/effects/fireworks'

const SCRIM = MUSIC_ENGINE === 'scrim'

/** `?audio=scrim`: the level's score while it runs (held while paused, through the resume Ready / GO), the results score after it. */
function followPhase(phase: GamePhase, level: string) {
  withScrim((p) => {
    if (phase === 'results') p.playScore('results')
    else if (phase === 'paused') p.pauseScore(true)
    else {
      p.playScore(level)
      p.pauseScore(false)
    }
  })
}

/** Level audio host: biome music + SFX kit for the level's lifetime, bus-driven hit / wave / combo-break / boss / firework sounds, slow-mo and pause duck. */
export default function MusicController() {
  const currentLevel = useGameStore((s) => s.currentLevel)

  useEffect(() => {
    syncVolumes()
    const biome = (currentLevel ? getLevelConfig(currentLevel)?.biome : undefined) ?? 'themePark'
    const level = currentLevel ?? 'level1'
    const unfollow = SCRIM
      ? useGameStore.subscribe((s, prev) => {
          if (s.phase !== prev.phase) followPhase(s.phase, level)
        })
      : null
    if (SCRIM) followPhase(useGameStore.getState().phase, level)
    else startMusic(biome)
    prepareLevelSFX(biome)
    eventBus.on('enemy:hit', playHitTick)
    eventBus.on('wave:announce', playWaveStinger)
    eventBus.on('combo:broken', playComboBreak)
    eventBus.on('boss:spawn', playBossStinger)
    eventBus.on('boss:hit', playBossHit)
    eventBus.on('boss:defeated', playBossDefeat)
    eventBus.on(FIREWORK_LAUNCH_EVENT, playFireworkWhistle)
    eventBus.on(FIREWORK_BURST_EVENT, playFireworkPop)
    return () => {
      eventBus.off(FIREWORK_BURST_EVENT, playFireworkPop)
      eventBus.off(FIREWORK_LAUNCH_EVENT, playFireworkWhistle)
      eventBus.off('boss:defeated', playBossDefeat)
      eventBus.off('boss:hit', playBossHit)
      eventBus.off('boss:spawn', playBossStinger)
      eventBus.off('combo:broken', playComboBreak)
      eventBus.off('enemy:hit', playHitTick)
      eventBus.off('wave:announce', playWaveStinger)
      if (unfollow) {
        unfollow()
        withScrim((p) => p.stopScore(level, 'results'))
      } else stopMusic()
      disposeSFX()
      setMusicDucked(false, true)
    }
  }, [currentLevel])

  // Not in useFrame: a hidden tab gets no frames but must still go quiet.
  useEffect(() => {
    const sync = (phase: string) => setPauseMix(phase === 'paused')
    sync(useGameStore.getState().phase)
    const unsubscribe = useGameStore.subscribe((s) => sync(s.phase))
    return () => {
      unsubscribe()
      setPauseMix(false, true)
    }
  }, [])

  useFrame(() => {
    const { combo, timeRemaining, timeScale, phase } = useGameStore.getState()
    setMusicDucked(timeScale < 1 || phase === 'paused')

    // Intensity ramps up quickly so the music feels alive from the start
    const comboFactor = Math.min(combo.count / 5, 1) * 0.3
    const timePressure = timeRemaining < 20 ? (1 - timeRemaining / 20) * 0.3 : 0
    const baseline = 0.45 // Start with pad + bass already playing
    const intensity = Math.min(1, baseline + comboFactor + timePressure)

    setMusicIntensity(intensity)
  })

  return null
}
