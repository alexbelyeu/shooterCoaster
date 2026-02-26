import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/store/useGameStore'
import { startMusic, stopMusic, setMusicIntensity } from '@/audio/MusicManager'
import { disposeSFX } from '@/audio/SFXManager'
import { syncVolumes } from '@/audio/AudioEngine'
import { getLevelConfig } from '@/levels/LevelRegistry'

/**
 * Manages adaptive music. Starts on mount (which happens when gameplay begins),
 * stops on unmount (level exit).
 */
export default function MusicController() {
  const currentLevel = useGameStore((s) => s.currentLevel)

  useEffect(() => {
    syncVolumes()
    const biome = currentLevel ? getLevelConfig(currentLevel)?.biome : undefined
    startMusic(biome)
    return () => {
      stopMusic()
      disposeSFX()
    }
  }, [currentLevel])

  useFrame(() => {
    const { combo, timeRemaining } = useGameStore.getState()
    // Intensity ramps up quickly so the music feels alive from the start
    const comboFactor = Math.min(combo.count / 5, 1) * 0.3
    const timePressure = timeRemaining < 20 ? (1 - timeRemaining / 20) * 0.3 : 0
    const baseline = 0.45 // Start with pad + bass already playing
    const intensity = Math.min(1, baseline + comboFactor + timePressure)

    setMusicIntensity(intensity)
  })

  return null
}
