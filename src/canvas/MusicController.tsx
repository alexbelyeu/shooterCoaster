import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { startMusic, stopMusic, setMusicIntensity } from '@/audio/MusicManager'
import { disposeSFX, playHitTick, playWaveStinger, prepareLevelSFX } from '@/audio/SFXManager'
import { setMusicDucked, syncVolumes } from '@/audio/AudioEngine'
import { eventBus } from '@/core/EventBus'
import { getLevelConfig } from '@/levels/LevelRegistry'

/** Level audio host: biome music + SFX kit for the level's lifetime, bus-driven hit / wave sounds, slow-mo duck. */
export default function MusicController() {
  const currentLevel = useGameStore((s) => s.currentLevel)

  useEffect(() => {
    syncVolumes()
    const biome = (currentLevel ? getLevelConfig(currentLevel)?.biome : undefined) ?? 'themePark'
    startMusic(biome)
    prepareLevelSFX(biome)
    eventBus.on('enemy:hit', playHitTick)
    eventBus.on('wave:announce', playWaveStinger)
    return () => {
      eventBus.off('enemy:hit', playHitTick)
      eventBus.off('wave:announce', playWaveStinger)
      stopMusic()
      disposeSFX()
      setMusicDucked(false, true)
    }
  }, [currentLevel])

  useFrame(() => {
    const { combo, timeRemaining, timeScale } = useGameStore.getState()
    setMusicDucked(timeScale < 1)

    // Intensity ramps up quickly so the music feels alive from the start
    const comboFactor = Math.min(combo.count / 5, 1) * 0.3
    const timePressure = timeRemaining < 20 ? (1 - timeRemaining / 20) * 0.3 : 0
    const baseline = 0.45 // Start with pad + bass already playing
    const intensity = Math.min(1, baseline + comboFactor + timePressure)

    setMusicIntensity(intensity)
  })

  return null
}
