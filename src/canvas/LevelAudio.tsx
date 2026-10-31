import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import type { GamePhase } from '@/types/game'
import { startMusic, stopMusic, setMusicIntensity } from '@/audio/MusicManager'
import { placeSound, prepareSfx, setSfxListener, sfx } from '@/audio/sfx'
import { isAudioReady, setMusicDucked, setPauseMix, whenAudioReady } from '@/audio/AudioEngine'
import { MUSIC_ENGINE, withScrim } from '@/audio/musicEngine'
import { eventBus } from '@/core/EventBus'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { FIREWORK_BURST_EVENT, FIREWORK_LAUNCH_EVENT } from '@/effects/fireworks'
import { TOP_TIER, comboTierIndex } from '@/combat/comboTiers'
import type { EnemyKilledEvent } from '@/combat/hitFeedback'

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

const onHit = (e: unknown) => sfx().hit(useGameStore.getState().combo.count, placeSound((e as { position?: THREE.Vector3 }).position))
const onKilled = (e: unknown) => {
  const { position, combo, sound = 'pop', bossPart } = e as EnemyKilledEvent
  if (bossPart) sfx().bossPart(combo, bossPart, placeSound(position))
  else sfx().kill(combo, sound, placeSound(position))
}
const onWaveIncoming = () => sfx().waveIncoming()
const onWaveAnnounce = () => sfx().waveAnnounce()
const onComboBreak = () => sfx().comboBreak()
const onFrenzy = () => sfx().frenzy()
const onBossSpawn = () => sfx().bossArrival()
const onBossHit = (e: unknown) => sfx().bossHit((e as { hpFraction?: number } | undefined)?.hpFraction ?? 1)
const onBossDefeated = () => sfx().bossDefeat()
const onFireworkLaunch = (e: unknown) => {
  const { flightS = 0, timeScale = 1 } = (e as { flightS?: number; timeScale?: number } | undefined) ?? {}
  sfx().fireworkWhistle(flightS, timeScale)
}
const onFireworkBurst = () => sfx().fireworkPop()

const SFX_EVENTS: [string, (e: unknown) => void][] = [
  ['enemy:hit', onHit],
  ['enemy:killed', onKilled],
  ['wave:incoming', onWaveIncoming],
  ['wave:announce', onWaveAnnounce],
  ['combo:broken', onComboBreak],
  ['combo:frenzy', onFrenzy],
  ['boss:spawn', onBossSpawn],
  ['boss:hit', onBossHit],
  ['boss:defeated', onBossDefeated],
  [FIREWORK_LAUNCH_EVENT, onFireworkLaunch],
  [FIREWORK_BURST_EVENT, onFireworkBurst],
]

/** Level audio host: biome music + SFX for the level's lifetime, bus-driven hit / kill / wave / combo / boss / firework sounds, slow-mo and pause duck. */
export default function LevelAudio() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    setSfxListener(camera)
    return () => setSfxListener(null)
  }, [camera])

  useEffect(() => {
    const biome = (currentLevel ? getLevelConfig(currentLevel)?.biome : undefined) ?? 'themePark'
    const level = currentLevel ?? 'level1'
    const unfollow = SCRIM
      ? useGameStore.subscribe((s, prev) => {
          if (s.phase !== prev.phase && isAudioReady()) followPhase(s.phase, level)
        })
      : null
    // Tone's chunk can land after the level mounts (PLAY waits for it only briefly).
    const cancelStart = whenAudioReady(() => {
      if (SCRIM) followPhase(useGameStore.getState().phase, level)
      else startMusic(biome)
      prepareSfx(level, biome)
    })
    for (const [event, fn] of SFX_EVENTS) eventBus.on(event, fn)
    return () => {
      cancelStart()
      for (const [event, fn] of SFX_EVENTS) eventBus.off(event, fn)
      if (unfollow) {
        unfollow()
        withScrim((p) => p.stopScore(level, 'results'))
      } else stopMusic()
      sfx().dispose(level)
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
    sfx().frenzyLift(phase === 'playing' && comboTierIndex(combo.count) === TOP_TIER)

    // Intensity ramps up quickly so the music feels alive from the start
    const comboFactor = Math.min(combo.count / 5, 1) * 0.3
    const timePressure = timeRemaining < 20 ? (1 - timeRemaining / 20) * 0.3 : 0
    const baseline = 0.45 // Start with pad + bass already playing
    const intensity = Math.min(1, baseline + comboFactor + timePressure)

    setMusicIntensity(intensity)
  })

  return null
}
