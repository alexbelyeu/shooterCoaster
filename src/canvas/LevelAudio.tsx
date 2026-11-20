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
import { reportLoad } from '@/core/loadProgress'
import { FIREWORK_BURST_EVENT, FIREWORK_LAUNCH_EVENT } from '@/effects/fireworks'
import { TOP_TIER, comboTierIndex } from '@/combat/comboTiers'
import { intensityForTier } from '@/audio/scrim/layers'
import { RESULTS_CUTS, resultsCut } from '@/audio/scores/resultsCut'
import { runStars } from '@/levels/scoring'
import type { EnemyKilledEvent } from '@/combat/hitFeedback'
import { SNOWBALL_SPLAT_EVENT } from '@/ui/hud/SnowSplat'
import { BYSTANDER_HIT_EVENT, type BystanderHitEvent } from '@/combat/bystanders'

/** The run's stars as the results screen shows them, which pick the results score's cut (#792, #797). */
function finishedRunStars(level: string): number {
  const config = getLevelConfig(level)
  return config ? runStars(useGameStore.getState().score, config) : 0
}

/**
 * The level's score while it runs (held while paused, through the resume Ready / GO), the results score after it: its
 * win cut for 2 or 3 stars, its lose cut for 0 or 1. Leaving for the title or level select: the unmount fades the
 * score, none is built to be faded (#236).
 */
function followPhase(phase: GamePhase, level: string): Promise<void> {
  if (!isInRun(phase) && phase !== 'results') return Promise.resolve()
  return withScrim((p) => {
    if (phase === 'results') p.playScore(resultsCut(finishedRunStars(level)))
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
const onBossHit = (e: unknown) => sfx().bossHit((e as { hpFraction?: number } | undefined)?.hpFraction ?? 1)
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
  ['boss:hit', onBossHit],
  [SNOWBALL_SPLAT_EVENT, onSnowSplat],
  [FIREWORK_LAUNCH_EVENT, onFireworkLaunch],
  [FIREWORK_BURST_EVENT, onFireworkBurst],
]

/** Level audio host: the level's score (its boss section from `boss:spawn`, a sting on `boss:defeated`) + SFX for the level's lifetime, bus-driven hit / kill / bystander / wave / combo / boss / firework sounds, slow-mo and pause duck, music intensity. */
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
      if (!isAudioReady()) return
      // A restart mid-boss takes the score back to its loop (from the pause menu: in place, before it resumes).
      if (s.runId !== prev.runId) withScrim((p) => p.playSection(level, 'main'))
      // Results → the next level: that level's own effect opens its score once its scene mounts (#236).
      if (s.phase !== prev.phase && s.currentLevel === currentLevel) followPhase(s.phase, level)
    })
    // The score's boss section from the boss's arrival, its victory sting on the defeat (then the loop again).
    const playSection = (section: 'boss' | 'sting') => {
      if (isAudioReady()) withScrim((p) => p.playSection(level, section))
    }
    const onBossSpawn = () => {
      sfx().bossArrival()
      playSection('boss')
    }
    const onBossDefeated = () => {
      sfx().bossDefeat()
      playSection('sting')
    }
    const bossEvents: [string, () => void][] = [
      ['boss:spawn', onBossSpawn],
      ['boss:defeated', onBossDefeated],
    ]
    // Audio can unlock after the level mounts (PLAY waits for it only briefly).
    // The loading screen waits for the SFX bake and the score's start (#674).
    const cancelStart = whenAudioReady(() => {
      void Promise.all([followPhase(useGameStore.getState().phase, level), prepareSfx(level, biome)]).then(() =>
        reportLoad(currentLevel, 'audio', 1),
      )
    })
    for (const [event, fn] of [...SFX_EVENTS, ...bossEvents]) eventBus.on(event, fn)
    return () => {
      cancelStart()
      for (const [event, fn] of [...SFX_EVENTS, ...bossEvents]) eventBus.off(event, fn)
      // Still in a run: the next level's track opens once its scene mounts, so fade under it, not before (#168).
      const nextLevel = isInRun(useGameStore.getState().phase)
      unfollow()
      withScrim((p) => (nextLevel ? p.handOverScore(level, ...RESULTS_CUTS) : p.stopScore(level, ...RESULTS_CUTS)))
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
    setMusicDucked(timeScale < 1)
    sfx().frenzyLift(phase === 'playing' && tier === TOP_TIER)
    scrimPlayer()?.setIntensity(intensityForTier(tier))
  })

  return null
}
