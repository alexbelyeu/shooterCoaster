import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Vector3 as ThreeVector3 } from 'three'
import { useGameStore } from '@/store/useGameStore'
import type { GamePhase } from '@/types/game'
import { placeSound, prepareSfx, setSfxListener, sfx } from '@/audio/sfx'
import { isAudioReady, setMusicDucked, setPauseMix, whenAudioReady } from '@/audio/AudioEngine'
import { scrimPlayer, withScrim } from '@/audio/musicEngine'
import { eventBus } from '@/core/EventBus'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { isInRun } from '@/store/startPhase'
import { FIREWORK_BURST_EVENT, FIREWORK_LAUNCH_EVENT } from '@/effects/fireworks'
import { TOP_TIER, comboTierIndex } from '@/combat/comboTiers'
import { intensityForTier } from '@/audio/scrim/layers'
import type { EnemyKilledEvent } from '@/combat/hitFeedback'
import { SNOWBALL_SPLAT_EVENT } from '@/ui/hud/SnowSplat'
import { BYSTANDER_HIT_EVENT, type BystanderHitEvent } from '@/combat/bystanders'

/** The level's score while it runs (held while paused, through the resume Ready / GO), the results score after it. */
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

const onHit = (e: unknown) => sfx().hit(useGameStore.getState().combo.count, placeSound((e as { position?: ThreeVector3 }).position))
const onKilled = (e: unknown) => {
  const { position, combo, sound = 'pop', bossPart } = e as EnemyKilledEvent
  if (bossPart) sfx().bossPart(combo, bossPart, placeSound(position))
  else sfx().kill(combo, sound, placeSound(position))
}
const onWaveIncoming = () => sfx().waveIncoming()
const onComboBreak = () => sfx().comboBreak()
const _at = new Vector3()
const onBystanderHit = (e: unknown) => {
  const { x, y, z } = (e as BystanderHitEvent).position
  sfx().penalty(placeSound(_at.set(x, y, z)))
}
const onFrenzy = () => sfx().frenzy()
const onBossSpawn = () => sfx().bossArrival()
const onBossHit = (e: unknown) => sfx().bossHit((e as { hpFraction?: number } | undefined)?.hpFraction ?? 1)
const onBossDefeated = () => sfx().bossDefeat()
const onFireworkLaunch = (e: unknown) => {
  const { flightS = 0, timeScale = 1 } = (e as { flightS?: number; timeScale?: number } | undefined) ?? {}
  sfx().fireworkWhistle(flightS, timeScale)
}
const onFireworkBurst = () => sfx().fireworkPop()
/** An unshot snowball thumps past: the snow crunch, unplaced (it is at the camera). */
const onSnowSplat = () => sfx().kill(0, 'crunch', null)

const SFX_EVENTS: [string, (e: unknown) => void][] = [
  ['enemy:hit', onHit],
  ['enemy:killed', onKilled],
  ['wave:incoming', onWaveIncoming],
  ['combo:broken', onComboBreak],
  [BYSTANDER_HIT_EVENT, onBystanderHit],
  ['combo:frenzy', onFrenzy],
  ['boss:spawn', onBossSpawn],
  ['boss:hit', onBossHit],
  ['boss:defeated', onBossDefeated],
  [SNOWBALL_SPLAT_EVENT, onSnowSplat],
  [FIREWORK_LAUNCH_EVENT, onFireworkLaunch],
  [FIREWORK_BURST_EVENT, onFireworkBurst],
]

/** Level audio host: the level's score + SFX for the level's lifetime, bus-driven hit / kill / bystander / wave / combo / boss / firework sounds, slow-mo and pause duck, music intensity. */
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
    const unfollow = useGameStore.subscribe((s, prev) => {
      if (s.phase !== prev.phase && isAudioReady()) followPhase(s.phase, level)
    })
    // Audio can unlock after the level mounts (PLAY waits for it only briefly).
    const cancelStart = whenAudioReady(() => {
      followPhase(useGameStore.getState().phase, level)
      void prepareSfx(level, biome)
    })
    for (const [event, fn] of SFX_EVENTS) eventBus.on(event, fn)
    return () => {
      cancelStart()
      for (const [event, fn] of SFX_EVENTS) eventBus.off(event, fn)
      // Still in a run: the next level's track opens once its scene mounts, so fade under it, not before (#168).
      const nextLevel = isInRun(useGameStore.getState().phase)
      unfollow()
      withScrim((p) => (nextLevel ? p.handOverScore(level, 'results') : p.stopScore(level, 'results')))
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
    const { combo, timeScale, phase } = useGameStore.getState()
    const tier = comboTierIndex(combo.count)
    setMusicDucked(timeScale < 1 || phase === 'paused')
    sfx().frenzyLift(phase === 'playing' && tier === TOP_TIER)
    scrimPlayer()?.setIntensity(intensityForTier(tier))
  })

  return null
}
