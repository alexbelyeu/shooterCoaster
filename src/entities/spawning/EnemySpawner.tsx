import { useMemo, useState, useCallback, useEffect, useRef, useContext } from 'react'
import * as THREE from 'three'
import type { EnemyType, EnemyWave } from '@/types/level'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import type { HeightFunction, TrackSample } from '@/utils/terrainNoise'
import { maxReadableDistance } from '../enemies/enemyReadability'
import Balloon from '../enemies/Balloon'
import Crow from '../enemies/Crow'
import Scorpion from '../enemies/Scorpion'
import Shark from '../enemies/Shark'
import Jellyfish from '../enemies/Jellyfish'
import FlyingFish from '../enemies/FlyingFish'
import Snowman from '../enemies/Snowman'
import SnowmanScout from '../enemies/SnowmanScout'
import SnowmanBrute from '../enemies/SnowmanBrute'
import EmberWisp from '../enemies/EmberWisp'
import LavaGolem from '../enemies/LavaGolem'
import FireImp from '../enemies/FireImp'
import InfernalDrake from '../enemies/InfernalDrake'
import GoldenBalloon from '../enemies/GoldenBalloon'
import { getExplosionPool } from '@/effects/explosionPoolHandle'
import { SCORE_VALUES } from '@/levels/scoring'
import { createRng, type Rng } from '@/utils/rng'
import { recordE2ESpawns } from '@/testing/e2eHook'

interface EnemySpawnerProps {
  waves: EnemyWave[]
  goldenBalloonCount?: number
  /** Track path samples; when given, spawns are kept within readable range of the track. */
  trackSamples?: TrackSample[]
}

interface SpawnedEnemy {
  id: string
  type: EnemyType | 'goldenBalloon'
  position: THREE.Vector3
  scoreValue: number
  radius: number
  waveIndex: number
}

const RADII: Record<EnemyType, number> = {
  balloon: 45,
  crow: 65,
  scorpion: 55,
  shark: 50,
  jellyfish: 40,
  flyingFish: 35,
  snowman: 115,
  snowmanScout: 70,
  snowmanBrute: 180,
  emberWisp: 35,
  lavaGolem: 130,
  fireImp: 55,
  infernalDrake: 200,
}

/** One random spawn position for `type` (terrain-aware, biome rules). */
function pickSpawn(type: EnemyType, heightFn: HeightFunction, rng: Rng): THREE.Vector3 {
  let x: number, y: number, z: number

  switch (type) {
    case 'crow': {
      const r = Math.sqrt(rng()) * 1200 + 100
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 100 + rng() * 160
      break
    }
    case 'scorpion': {
      const r = Math.sqrt(rng()) * 600 + 100
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 5
      break
    }
    case 'shark':
    case 'jellyfish':
    case 'flyingFish': {
      // Aquatic enemies: only spawn where terrain is below water (y=0)
      let attempts = 0
      do {
        const r = Math.sqrt(rng()) * 1000 + 100
        const theta = rng() * 2 * Math.PI
        x = Math.cos(theta) * r
        z = Math.sin(theta) * r
        attempts++
      } while (heightFn(x, z) > -5 && attempts < 20)

      if (type === 'shark') {
        y = 2
      } else if (type === 'jellyfish') {
        y = -15 - rng() * 30
      } else {
        y = 0
      }
      break
    }
    case 'snowman':
    case 'snowmanScout':
    case 'snowmanBrute': {
      const r = Math.sqrt(rng()) * 2200 + 200
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 5
      break
    }
    case 'emberWisp': {
      const r = Math.sqrt(rng()) * 2800 + 200
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 60 + rng() * 140
      break
    }
    case 'lavaGolem': {
      const r = Math.sqrt(rng()) * 2400 + 200
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 5
      break
    }
    case 'fireImp': {
      const r = Math.sqrt(rng()) * 2200 + 200
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 5
      break
    }
    case 'infernalDrake': {
      const r = Math.sqrt(rng()) * 2600 + 300
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 150 + rng() * 100
      break
    }
    default: {
      // Scatter balloons over the park, a little beyond the track (~±1100),
      // so they float close to the ride (issue #20). sqrt = uniform area density.
      const r = Math.sqrt(rng()) * 1700
      const theta = rng() * 2 * Math.PI
      x = Math.cos(theta) * r
      z = Math.sin(theta) * r
      y = heightFn(x, z) + 40 + rng() * 160
      break
    }
  }
  return new THREE.Vector3(x, y, z)
}

/** Squared distance from (x, y, z) to the nearest track sample (every 2nd sample). */
function trackDistSq(p: THREE.Vector3, samples: TrackSample[]): number {
  let best = Infinity
  for (let i = 0; i < samples.length; i += 2) {
    const s = samples[i]
    const dx = s.x - p.x
    const dy = s.y - p.y
    const dz = s.z - p.z
    const d = dx * dx + dy * dy + dz * dz
    if (d < best) best = d
  }
  return best
}

const READABLE_SPAWN_ATTEMPTS = 30

/**
 * Like pickSpawn, but re-rolls until the enemy is within maxReadableDistance of
 * some point of the track, so it reaches ≥ MIN_ENEMY_PX on screen at least once
 * during the ride (issue #15). Falls back to the closest candidate.
 */
function pickReadableSpawn(
  type: EnemyType | 'goldenBalloon',
  trackSamples: TrackSample[] | undefined,
  pick: () => THREE.Vector3,
): THREE.Vector3 {
  if (!trackSamples || trackSamples.length === 0) return pick()
  const maxSq = maxReadableDistance(type) ** 2
  let best = pick()
  let bestSq = trackDistSq(best, trackSamples)
  for (let i = 1; i < READABLE_SPAWN_ATTEMPTS && bestSq > maxSq; i++) {
    const p = pick()
    const d = trackDistSq(p, trackSamples)
    if (d < bestSq) {
      best = p
      bestSq = d
    }
  }
  return best
}

/**
 * Spawn enemies with terrain-aware positioning.
 * Ground enemies (scorpion, snowman) sit on the terrain surface.
 * Flying enemies (crow, balloon) hover above the terrain.
 * Sharks sit at water level (y=2).
 */
function generateEnemies(
  waves: EnemyWave[],
  heightFn: HeightFunction,
  rng: Rng,
  trackSamples?: TrackSample[],
): SpawnedEnemy[] {
  const enemies: SpawnedEnemy[] = []
  let id = 0

  // Each config entry is its own wave group. Waves activate at their
  // spawnDelay (seconds from level start) via time-based progression.
  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    const wave = waves[waveIdx]
    const pick = () => pickSpawn(wave.type, heightFn, rng)
    for (let i = 0; i < wave.count; i++) {
      const p = pickReadableSpawn(wave.type, trackSamples, pick)

      enemies.push({
        id: `enemy-${id++}`,
        type: wave.type,
        position: p,
        scoreValue: SCORE_VALUES[wave.type],
        radius: RADII[wave.type],
        waveIndex: waveIdx,
      })
    }
  }

  return enemies
}

function generateGoldenBalloons(
  count: number,
  heightFn: HeightFunction,
  rng: Rng,
  trackSamples?: TrackSample[],
): SpawnedEnemy[] {
  const goldens: SpawnedEnemy[] = []
  const pick = () => {
    const r = Math.sqrt(rng()) * 3000
    const theta = rng() * 2 * Math.PI
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    return new THREE.Vector3(x, heightFn(x, z) + 50 + rng() * 100, z)
  }
  for (let i = 0; i < count; i++) {
    goldens.push({
      id: `golden-${i}`,
      type: 'goldenBalloon',
      position: pickReadableSpawn('goldenBalloon', trackSamples, pick),
      scoreValue: 13 * 5, // 5x points
      radius: 45,
      waveIndex: -1, // always visible
    })
  }
  return goldens
}

const ENEMY_COMPONENTS: Record<EnemyType, React.ComponentType<any>> = {
  balloon: Balloon,
  crow: Crow,
  scorpion: Scorpion,
  shark: Shark,
  jellyfish: Jellyfish,
  flyingFish: FlyingFish,
  snowman: Snowman,
  snowmanScout: SnowmanScout,
  snowmanBrute: SnowmanBrute,
  emberWisp: EmberWisp,
  lavaGolem: LavaGolem,
  fireImp: FireImp,
  infernalDrake: InfernalDrake,
}

const EXPLOSION_COLORS = ['#ff4444', '#ffaa00', '#ffffff', '#44aaff', '#00ff88']

export default function EnemySpawner({ waves, goldenBalloonCount = 0, trackSamples }: EnemySpawnerProps) {
  const heightFn = useContext(TerrainContext)
  const runSeed = useGameStore((s) => s.runSeed)
  // One stream per run: the same seed gives the same enemies and golden balloons.
  const { enemies, goldenBalloons } = useMemo(() => {
    const rng = createRng(runSeed)
    return {
      enemies: generateEnemies(waves, heightFn, rng, trackSamples),
      goldenBalloons: generateGoldenBalloons(goldenBalloonCount, heightFn, rng, trackSamples),
    }
  }, [runSeed, waves, goldenBalloonCount, heightFn, trackSamples])
  useEffect(() => {
    recordE2ESpawns([...enemies, ...goldenBalloons].map((e) => e.position))
  }, [enemies, goldenBalloons])
  const phase = useGameStore((s) => s.phase)

  // Wave state — time-based progression
  // All waves with spawnDelay 0 are immediately active
  const initialActiveWave = useMemo(
    () => waves.reduce((max, w, i) => ((w.spawnDelay ?? 0) === 0 ? i : max), 0),
    [waves],
  )
  const [activeWaveIndex, setActiveWaveIndex] = useState(initialActiveWave)
  const [waveAnnouncement, setWaveAnnouncement] = useState<string | null>(
    phase === 'playing' ? waves[0]?.waveLabel ?? null : null,
  )
  const waveTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const slowMoResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const killedEnemies = useRef(new Set<string>())

  // Generation counter — increments on replay to force enemy remount
  const [generation, setGeneration] = useState(0)
  const prevPhaseRef = useRef(phase)

  // A run (re)start resets the waves and remounts the enemies; GO after a countdown only announces wave 1.
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === prev) return

    if (phase === 'playing' && prev === 'countdown') {
      setWaveAnnouncement(waves[0]?.waveLabel ?? null)
    } else if (phase === 'countdown' || phase === 'playing') {
      setActiveWaveIndex(initialActiveWave)
      setWaveAnnouncement(phase === 'playing' ? waves[0]?.waveLabel ?? null : null)
      killedEnemies.current.clear()
      setGeneration((g) => g + 1)
    }
  }, [phase, initialActiveWave, waves])

  const totalEnemyCount = useMemo(
    () => enemies.length,
    [enemies],
  )

  const setEnemyCounts = useGameStore((s) => s.setEnemyCounts)
  useEffect(() => {
    setEnemyCounts(totalEnemyCount, totalEnemyCount)
  }, [totalEnemyCount, setEnemyCounts])

  useEffect(() => {
    if (!waveAnnouncement) return
    const t = setTimeout(() => setWaveAnnouncement(null), 2000)
    return () => clearTimeout(t)
  }, [waveAnnouncement])

  // Time-based wave activation: schedule each wave's appearance from level start
  useEffect(() => {
    if (phase !== 'playing') return

    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < waves.length; i++) {
      const delay = (waves[i].spawnDelay ?? 0) * 1000
      if (delay > 0) {
        const t = setTimeout(() => {
          setActiveWaveIndex(i)
          if (waves[i].waveLabel) {
            setWaveAnnouncement(waves[i].waveLabel!)
          }
          if (waves[i].isEruption) {
            eventBus.emit('eruption:start')
          }
        }, delay)
        timers.push(t)
      }
    }
    waveTimers.current = timers

    return () => {
      timers.forEach(clearTimeout)
      waveTimers.current = []
    }
  }, [phase, waves])

  useEffect(() => {
    return () => {
      waveTimers.current.forEach(clearTimeout)
      waveTimers.current = []
      if (slowMoResetTimer.current) clearTimeout(slowMoResetTimer.current)
      slowMoResetTimer.current = null
      killedEnemies.current.clear()
    }
  }, [])

  const onKill = useCallback(
    (id: string, position: THREE.Vector3) => {
      killedEnemies.current.add(id)

      const remaining = totalEnemyCount - killedEnemies.current.size
      useGameStore.getState().setEnemyCounts(Math.max(0, remaining), totalEnemyCount)

      if (killedEnemies.current.size >= totalEnemyCount) {
        const store = useGameStore.getState()
        store.setTimeScale(0.1)
        if (slowMoResetTimer.current) clearTimeout(slowMoResetTimer.current)
        slowMoResetTimer.current = setTimeout(() => {
          useGameStore.getState().setTimeScale(1)
        }, 1500)
      }

      const color = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)]
      getExplosionPool()?.activate(position, color)
    },
    [totalEnemyCount],
  )

  useEffect(() => {
    if (waveAnnouncement) {
      eventBus.emit('wave:announce', waveAnnouncement)
    }
  }, [waveAnnouncement])

  const visibleEnemies = useMemo(() => {
    return enemies.filter((e) => e.waveIndex <= activeWaveIndex)
  }, [enemies, activeWaveIndex])

  return (
    <>
      {visibleEnemies.map((enemy) => {
        const Component = ENEMY_COMPONENTS[enemy.type as EnemyType]
        if (!Component) return null
        return (
          <Component
            key={`${enemy.id}-${generation}-${runSeed}`}
            id={enemy.id}
            type={enemy.type}
            spawnPosition={enemy.position}
            scoreValue={enemy.scoreValue}
            radius={enemy.radius}
            onKill={onKill}
          />
        )
      })}
      {goldenBalloons.map((gb) => (
        <GoldenBalloon
          key={`${gb.id}-${generation}-${runSeed}`}
          id={gb.id}
          type="balloon"
          spawnPosition={gb.position}
          scoreValue={gb.scoreValue}
          radius={gb.radius}
          onKill={onKill}
        />
      ))}
    </>
  )
}
