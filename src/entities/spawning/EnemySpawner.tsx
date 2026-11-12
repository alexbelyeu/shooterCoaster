import { useMemo, useState, useCallback, useEffect, useRef, useContext } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { EnemyType, EnemyWave, LevelConfig, WallSurface } from '@/types/level'
import { indexAtT, type ArcTable } from '@/track/arcLength'
import { rideProgress } from '@/track/rideProgress'
import { rideProfile, riddenBetween, type RideSpeeds } from '@/track/ridePhysics'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import type { HeightFunction } from '@/utils/terrainNoise'
import { ENEMY_COMPONENTS } from '../enemies/enemyComponents'
import GoldenBalloon from '../enemies/GoldenBalloon'
import BossSpawner from '../bosses/BossSpawner'
import { GOLDEN_BALLOON, SCORE_VALUES } from '@/levels/scoring'
import { createRng, type Rng } from '@/utils/rng'
import { recordE2ESpawns, registerE2EWaves } from '@/testing/e2eHook'
import { requestSlowMo } from '@/combat/slowMo'
import type { EnemyEntry } from '../enemies/EnemyBase'
import {
  ENTRY_SECONDS, ENTRY_STAGGER, formationSlots, outsideNearField, placeFormationWave, placeTracksideWave, trackPoint, tracksideSlots,
  type FormationMotion, type FormationSlot, type RideAhead, type TracksideSlot, type Vec3,
} from './spawnPlacement'
import {
  ENEMY_PLACEMENT, GOLDEN_BALLOON_SCATTER, WALL_STANDOFF, readableScatterSpawn, wallPoint, wallSlots, type WallSlot,
} from './enemyPlacement'
import { newWaveProgress, nextWaveDue, tickWaves, waveWindows } from './waveSchedule'

interface EnemySpawnerProps {
  waves: EnemyWave[]
  goldenBalloonCount?: number
  trackTable: ArcTable
  /** Terrain as drawn, not `heightFn`. */
  groundFn: HeightFunction
  /** The level's finale. */
  boss?: LevelConfig['boss']
  /** The level timer, which waves and the boss run on. */
  timerSeconds: number
  /** The ride's speeds and structure scale: waves are placed where the rider will be looking (`RideAhead`). */
  rideSpeeds: RideSpeeds
  trackScale: number
  walls?: readonly WallSurface[]
}

interface SpawnedEnemy {
  id: string
  type: EnemyType | 'goldenBalloon'
  /** Scatter and wall waves only: formation and trackside members are placed from their slot when the wave activates. */
  position: THREE.Vector3 | null
  slot: FormationSlot | null
  trackside: TracksideSlot | null
  wall?: WallSlot
  scoreValue: number
  radius: number
  waveIndex: number
}

interface Placed {
  position: THREE.Vector3
  entry?: EnemyEntry
  motion?: FormationMotion
}

const RADII: Record<EnemyType, number> = {
  balloon: 45,
  crow: 65,
  scorpion: 55,
  shark: 50,
  jellyfish: 40,
  flyingFish: 35,
  snowman: 150,
  snowmanScout: 105,
  snowmanBrute: 180,
  emberWisp: 35,
  lavaGolem: 130,
  fireImp: 55,
  infernalDrake: 200,
  climber: 50,
}

const NO_WALLS: readonly WallSurface[] = []

const toVector3 = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z)

/** Every enemy of the level: scatter positions now, formation and trackside slots for placement at activation. */
function generateEnemies(
  waves: EnemyWave[],
  heightFn: HeightFunction,
  rng: Rng,
  table: ArcTable,
  walls: readonly WallSurface[],
): SpawnedEnemy[] {
  const enemies: SpawnedEnemy[] = []
  let id = 0

  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    const wave = waves[waveIdx]
    const base = { type: wave.type, scoreValue: SCORE_VALUES[wave.type], radius: RADII[wave.type], waveIndex: waveIdx }
    const { surface, scatter } = ENEMY_PLACEMENT[wave.type]
    if (scatter === 'wall') {
      if (wave.formation && wave.formation !== 'scatter') throw new Error(`${wave.type} climbs a wall: no formation`)
      for (const wall of wallSlots(wave.count, walls, rng)) {
        const position = toVector3(wallPoint(wall.wall, wall.u, wall.v, WALL_STANDOFF, { x: 0, y: 0, z: 0 }))
        enemies.push({ id: `enemy-${id++}`, position, slot: null, trackside: null, wall, ...base })
      }
      continue
    }
    if (wave.formation && wave.formation !== 'scatter') {
      for (const slot of formationSlots(wave.formation, wave.count, rng)) {
        enemies.push({ id: `enemy-${id++}`, position: null, slot, trackside: null, ...base })
      }
      continue
    }
    if (scatter === 'trackside') {
      for (const trackside of tracksideSlots(wave.count, surface, rng)) {
        enemies.push({ id: `enemy-${id++}`, position: null, slot: null, trackside, ...base })
      }
      continue
    }
    for (let i = 0; i < wave.count; i++) {
      const position = toVector3(readableScatterSpawn(wave.type, scatter, surface, table, heightFn, rng))
      enemies.push({ id: `enemy-${id++}`, position, slot: null, trackside: null, ...base })
    }
  }

  return enemies
}

type GoldenBalloonSpawn = SpawnedEnemy & { position: THREE.Vector3 }

function generateGoldenBalloons(
  count: number,
  heightFn: HeightFunction,
  rng: Rng,
  table: ArcTable,
): GoldenBalloonSpawn[] {
  const goldens: GoldenBalloonSpawn[] = []
  for (let i = 0; i < count; i++) {
    goldens.push({
      id: `golden-${i}`,
      type: 'goldenBalloon',
      position: toVector3(readableScatterSpawn('goldenBalloon', GOLDEN_BALLOON_SCATTER, 'air', table, heightFn, rng)),
      slot: null,
      trackside: null,
      scoreValue: GOLDEN_BALLOON.score,
      radius: 45,
      waveIndex: -1, // always visible
    })
  }
  return goldens
}

export default function EnemySpawner({
  waves,
  goldenBalloonCount = 0,
  trackTable,
  groundFn,
  boss,
  timerSeconds,
  rideSpeeds,
  trackScale,
  walls = NO_WALLS,
}: EnemySpawnerProps) {
  const heightFn = useContext(TerrainContext)
  const getThree = useThree((s) => s.get)
  const runSeed = useGameStore((s) => s.runSeed)
  // One stream per run: the same seed gives the same enemies and golden balloons.
  const { enemies, goldenBalloons } = useMemo(() => {
    const rng = createRng(runSeed)
    return {
      enemies: generateEnemies(waves, heightFn, rng, trackTable, walls),
      goldenBalloons: generateGoldenBalloons(goldenBalloonCount, heightFn, rng, trackTable),
    }
  }, [runSeed, waves, goldenBalloonCount, heightFn, trackTable, walls])
  useEffect(() => {
    // Formation and trackside members digest their seeded slots: their world positions depend on where the rider is at activation.
    recordE2ESpawns([...enemies, ...goldenBalloons].map((e) => e.position ?? e.slot?.local ?? { x: e.trackside!.ahead, y: 0, z: e.trackside!.side }))
  }, [enemies, goldenBalloons])
  const phase = useGameStore((s) => s.phase)

  const waveDelays = useMemo(() => waves.map((w) => w.spawnDelay ?? 0), [waves])
  // The ride a run takes from GO, so each wave knows how far the rider goes while it flies in and before the next one.
  const rideAhead = useMemo((): RideAhead[] => {
    const profile = rideProfile(trackTable, rideSpeeds, timerSeconds)
    return waveWindows(waveDelays, boss?.at, timerSeconds).map(([from, to]) => ({
      entry: riddenBetween(profile, from, from + ENTRY_SECONDS + ENTRY_STAGGER),
      window: riddenBetween(profile, from, to),
      trackScale,
    }))
  }, [trackTable, rideSpeeds, timerSeconds, waveDelays, boss?.at, trackScale])

  const placeWave = useCallback(
    (waveIdx: number, riderIndex: number, camera: Vec3): [string, Placed][] => {
      const wave = waves[waveIdx]
      const ride = rideAhead[waveIdx]
      const members = enemies.filter((e) => e.waveIndex === waveIdx)
      if (members[0]?.trackside) {
        const placed = placeTracksideWave({
          table: trackTable, riderIndex, camera, type: wave.type, groundFn, slots: members.map((e) => e.trackside!), ride,
        })
        return members.map((e, i) => [e.id, { position: toVector3(placed[i]) }])
      }
      // On their walls already, where they enter: never pushed out of the near field.
      if (members[0]?.wall) return members.map((e) => [e.id, { position: e.position! }])
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
        ride,
      })
      return members.map((e, i) => {
        const p = placed[i]
        return [e.id, { position: toVector3(p.position), entry: { from: p.from, spin: p.spin, seconds: p.entrySeconds }, motion: p.motion }]
      })
    },
    [waves, enemies, trackTable, groundFn, rideAhead],
  )

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
  const runId = useGameStore((s) => s.runId)
  const [placements, setPlacements] = useState(initialPlacements)
  // A new run or seed re-places during render, before stale positions mount.
  const [placedFor, setPlacedFor] = useState({ runId, initialPlacements })
  if (placedFor.runId !== runId || placedFor.initialPlacements !== initialPlacements) {
    setPlacedFor({ runId, initialPlacements })
    setPlacements(initialPlacements)
  }

  const [activeWaveIndex, setActiveWaveIndex] = useState(initialActiveWave)
  const [waveAnnouncement, setWaveAnnouncement] = useState<string | null>(
    phase === 'playing' ? waves[0]?.waveLabel ?? null : null,
  )
  const waveProgress = useRef(newWaveProgress(waves.length))
  /** Level time of the last wave tick, for the e2e probe. */
  const lastWaveTick = useRef<number | null>(null)
  const goneEnemies = useRef(new Set<string>())

  const [generation, setGeneration] = useState(0)
  const runRef = useRef(runId)
  const firstWaveAnnounced = useRef(phase === 'playing')

  // A new run (Restart from pause included) resets the waves and remounts the enemies and the boss.
  useEffect(() => {
    if (runRef.current === runId) return
    runRef.current = runId
    setActiveWaveIndex(initialActiveWave)
    setWaveAnnouncement(null)
    firstWaveAnnounced.current = false
    waveProgress.current = newWaveProgress(waves.length)
    lastWaveTick.current = null
    goneEnemies.current.clear()
    setGeneration((g) => g + 1)
  }, [runId, initialActiveWave, waves])

  // Also after a resume, when the run was paused during its countdown.
  useEffect(() => {
    if (phase !== 'playing' || firstWaveAnnounced.current) return
    firstWaveAnnounced.current = true
    setWaveAnnouncement(waves[0]?.waveLabel ?? null)
  }, [phase, runId, waves])

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

  /** Places wave `i` ahead of the rider (once per run), mounts and announces it. */
  const activateWave = useCallback(
    (i: number) => {
      const p = getThree().camera.position
      const camera = { x: p.x, y: p.y, z: p.z }
      const riderIndex = indexAtT(trackTable, rideProgress())
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

  useEffect(() => {
    registerE2EWaves(() => ({
      levelTime: timerSeconds - useGameStore.getState().timeRemaining,
      due: nextWaveDue(waveDelays, waveProgress.current),
      lastTick: lastWaveTick.current,
    }))
    return () => registerE2EWaves(null)
  }, [waveDelays, timerSeconds])
  const tellWave = useCallback((i: number) => eventBus.emit('wave:incoming', waves[i].waveLabel), [waves])
  // On the level timer like the boss, so a pause holds them; the rendered phase keeps a restart from reading the last run's timer.
  useFrame(() => {
    const s = useGameStore.getState()
    if (phase !== 'playing' || s.phase !== 'playing') return
    const levelTime = timerSeconds - s.timeRemaining
    tickWaves(waveDelays, levelTime, waveProgress.current, tellWave, activateWave)
    lastWaveTick.current = levelTime
  })

  useEffect(() => {
    const gone = goneEnemies.current
    return () => gone.clear()
  }, [])

  const onKill = useCallback(
    (id: string) => {
      goneEnemies.current.add(id)

      const remaining = totalEnemyCount - goneEnemies.current.size
      useGameStore.getState().setEnemyCounts(Math.max(0, remaining), totalEnemyCount)

      if (goneEnemies.current.size >= totalEnemyCount) requestSlowMo('lastKill')
    },
    [totalEnemyCount],
  )

  // Gone without a kill (a climber topped out): off the count, no last-kill slow-mo.
  const onEscape = useCallback(
    (id: string) => {
      goneEnemies.current.add(id)
      useGameStore.getState().setEnemyCounts(Math.max(0, totalEnemyCount - goneEnemies.current.size), totalEnemyCount)
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
        const type = enemy.type as EnemyType
        const Component = ENEMY_COMPONENTS[type]
        if (!placed || !Component) return null
        return (
          <Component
            key={`${enemy.id}-${generation}-${runSeed}`}
            id={enemy.id}
            type={type}
            spawnPosition={placed.position}
            entry={placed.entry}
            motion={placed.motion}
            scoreValue={enemy.scoreValue}
            radius={enemy.radius}
            onKill={onKill}
            wall={enemy.wall}
            onEscape={onEscape}
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
      {boss && (
        <BossSpawner
          key={`boss-${generation}-${runSeed}`}
          boss={boss}
          timerSeconds={timerSeconds}
          track={trackTable}
          groundFn={groundFn}
        />
      )}
    </>
  )
}
