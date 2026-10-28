import { useMemo, useState, useCallback, useEffect, useRef, useContext } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { EnemyType, EnemyWave } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
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
import type { EnemyEntry } from '../enemies/EnemyBase'
import {
  formationSlots, nearestTrackIndex, outsideNearField, placeFormationWave, trackPoint,
  type FormationSlot, type Vec3,
} from './spawnPlacement'

interface EnemySpawnerProps {
  waves: EnemyWave[]
  goldenBalloonCount?: number
  /** Track path samples; when given, spawns are kept within readable range of the track. */
  trackSamples?: TrackSample[]
  /** Arc table of the track: formations are anchored ahead of the rider on it. */
  trackTable: ArcTable
  /** Terrain as drawn: formations stay on / above it. */
  groundFn: HeightFunction
}

interface SpawnedEnemy {
  id: string
  type: EnemyType | 'goldenBalloon'
  /** Scatter spawn point; formation members get theirs when the wave activates. */
  position: THREE.Vector3 | null
  /** Formation members: slot in the group's frame. */
  slot: FormationSlot | null
  scoreValue: number
  radius: number
  waveIndex: number
}

/** Where a mounted enemy is and how it arrives. */
interface Placed {
  position: THREE.Vector3
  entry?: EnemyEntry
  heading?: number
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
    const base = { type: wave.type, scoreValue: SCORE_VALUES[wave.type], radius: RADII[wave.type], waveIndex: waveIdx }
    if (wave.formation && wave.formation !== 'scatter') {
      for (const slot of formationSlots(wave.formation, wave.count, rng)) {
        enemies.push({ id: `enemy-${id++}`, position: null, slot, ...base })
      }
      continue
    }
    const pick = () => pickSpawn(wave.type, heightFn, rng)
    for (let i = 0; i < wave.count; i++) {
      enemies.push({ id: `enemy-${id++}`, position: pickReadableSpawn(wave.type, trackSamples, pick), slot: null, ...base })
    }
  }

  return enemies
}

type GoldenBalloonSpawn = SpawnedEnemy & { position: THREE.Vector3 }

function generateGoldenBalloons(
  count: number,
  heightFn: HeightFunction,
  rng: Rng,
  trackSamples?: TrackSample[],
): GoldenBalloonSpawn[] {
  const goldens: GoldenBalloonSpawn[] = []
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
      slot: null,
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

const toVector3 = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z)

/** The wave tell (`wave:incoming`) leads a wave's activation by this much. */
const WAVE_TELL_MS = 1000

export default function EnemySpawner({
  waves,
  goldenBalloonCount = 0,
  trackSamples,
  trackTable,
  groundFn,
}: EnemySpawnerProps) {
  const heightFn = useContext(TerrainContext)
  const getThree = useThree((s) => s.get)
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
    // Formation members digest their seeded slots: where they end up depends on where the rider is at activation.
    recordE2ESpawns([...enemies, ...goldenBalloons].map((e) => e.position ?? e.slot!.local))
  }, [enemies, goldenBalloons])
  const phase = useGameStore((s) => s.phase)

  /** Placements for wave `waveIdx` with the rider at track sample `riderIndex`. */
  const placeWave = useCallback(
    (waveIdx: number, riderIndex: number, camera: Vec3): [string, Placed][] => {
      const wave = waves[waveIdx]
      const members = enemies.filter((e) => e.waveIndex === waveIdx)
      if (!wave.formation || wave.formation === 'scatter') {
        return members.map((e) => [e.id, { position: toVector3(outsideNearField(e.position!, camera)) }])
      }
      const placed = placeFormationWave({
        table: trackTable,
        riderIndex,
        camera,
        formation: wave.formation,
        origin: wave.formationOrigin,
        type: wave.type,
        groundFn,
        slots: members.map((e) => e.slot!),
      })
      return members.map((e, i) => {
        const p = placed[i]
        return [e.id, { position: toVector3(p.position), entry: { from: p.from, spin: p.spin, seconds: p.entrySeconds }, heading: p.heading }]
      })
    },
    [waves, enemies, trackTable, groundFn],
  )

  // Wave state — time-based progression
  // All waves with spawnDelay 0 are immediately active
  const initialActiveWave = useMemo(
    () => waves.reduce((max, w, i) => ((w.spawnDelay ?? 0) === 0 ? i : max), 0),
    [waves],
  )
  // Waves live from the start are placed for the start of the track, where every run begins.
  const initialPlacements = useMemo(() => {
    const start = trackPoint(trackTable, 0)
    const m = new Map<string, Placed>()
    for (let i = 0; i <= initialActiveWave; i++) {
      for (const [id, p] of placeWave(i, 0, start)) m.set(id, p)
    }
    return m
  }, [placeWave, initialActiveWave, trackTable])
  const [placements, setPlacements] = useState(initialPlacements)
  // A new seed (same level restarted while playing) re-places during render, before stale positions mount.
  const [placementsSource, setPlacementsSource] = useState(initialPlacements)
  if (placementsSource !== initialPlacements) {
    setPlacementsSource(initialPlacements)
    setPlacements(initialPlacements)
  }

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
      setPlacements(initialPlacements)
      setWaveAnnouncement(phase === 'playing' ? waves[0]?.waveLabel ?? null : null)
      killedEnemies.current.clear()
      setGeneration((g) => g + 1)
    }
  }, [phase, initialActiveWave, initialPlacements, waves])

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

  /** Bring wave `i` in now: place it ahead of the rider (once per run), mount it, announce it. */
  const activateWave = useCallback(
    (i: number) => {
      const p = getThree().camera.position
      const camera = { x: p.x, y: p.y, z: p.z }
      const riderIndex = nearestTrackIndex(trackTable, camera)
      setPlacements((prev) => {
        const first = enemies.find((e) => e.waveIndex === i)
        if (!first || prev.has(first.id)) return prev
        const next = new Map(prev)
        for (const [id, placed] of placeWave(i, riderIndex, camera)) next.set(id, placed)
        return next
      })
      setActiveWaveIndex((a) => Math.max(a, i))
      if (waves[i].waveLabel) setWaveAnnouncement(waves[i].waveLabel!)
      if (waves[i].isEruption) eventBus.emit('eruption:start')
    },
    [getThree, trackTable, enemies, placeWave, waves],
  )

  // Time-based wave activation: schedule each wave's tell and appearance from level start
  useEffect(() => {
    if (phase !== 'playing') return

    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < waves.length; i++) {
      const delay = (waves[i].spawnDelay ?? 0) * 1000
      if (delay > 0) {
        const label = waves[i].waveLabel
        timers.push(setTimeout(() => eventBus.emit('wave:incoming', label), Math.max(0, delay - WAVE_TELL_MS)))
        timers.push(setTimeout(() => activateWave(i), delay))
      }
    }
    waveTimers.current = timers

    return () => {
      timers.forEach(clearTimeout)
      waveTimers.current = []
    }
  }, [phase, waves, activateWave])

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

  return (
    <>
      {enemies.map((enemy) => {
        const placed = enemy.waveIndex <= activeWaveIndex ? placements.get(enemy.id) : undefined
        const Component = ENEMY_COMPONENTS[enemy.type as EnemyType]
        if (!placed || !Component) return null
        return (
          <Component
            key={`${enemy.id}-${generation}-${runSeed}`}
            id={enemy.id}
            type={enemy.type}
            spawnPosition={placed.position}
            entry={placed.entry}
            heading={placed.heading}
            formation={waves[enemy.waveIndex].formation}
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
