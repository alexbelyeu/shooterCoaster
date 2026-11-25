import { use, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { LevelConfig, LevelRide } from '@/types/level'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import TrackMesh from '@/track/TrackMesh'
import { getTrackDimensions } from '@/track/trackDimensions'
import { e2eRide, isE2E } from '@/testing/e2eHook'
import { buildArcTable } from '@/track/arcLength'
import { withDarkSections, withTunnels } from '@/track/setPieces'
import CoasterCamera from '@/track/CoasterCamera'
import PhotoCamera from '@/track/PhotoCamera'
import { rideModel } from '@/track/ridePhysics'
import BiomeEnvironment from '@/levels/environments/BiomeEnvironment'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { forgetWorldFailures, groundOf, levelRide, loadedWorld, loadWorld, WorldContext, type World } from '@/levels/environments/worlds'
import ContactShadows from '@/levels/environments/shared/ContactShadows'
import {
  createTerrainSurface,
  getTerrainMeshSize,
  sampleTrackPath,
} from '@/utils/terrainNoise'
import BulletPool from '@/combat/projectiles/BulletPool'
import Pickups from '@/combat/pickups/Pickups'
import ParticleExplosionPool from '@/effects/ParticleExplosion'
import EnemySpawner from '@/entities/spawning/EnemySpawner'
import { hardRouteFor, hardRouteOf, withBackwards } from '@/track/mechanics'
import { sampleTrackXZ, setTrackOutline } from '@/track/trackOutline'
import { eventBus } from '@/core/EventBus'
import { BYSTANDER_HIT_EVENT, bystanderWarning, type BystanderHitEvent } from '@/combat/bystanders'
import type { EnemyKilledEvent } from '@/combat/hitFeedback'
import ShootingController from './ShootingController'
import GameTimer from './GameTimer'
import ShaderWarmup from './ShaderWarmup'
import LevelAudio from './LevelAudio'
import { levelWeather } from '@/levels/environments/shared/weatherPulse'
import { useGameStore } from '@/store/useGameStore'
import type { EnemyWave } from '@/types/level'

/** A Boss Rush stage (#1011) is its boss alone: no waves, no golden balloons. */
const NO_WAVES: EnemyWave[] = []

/** Projects 'enemy:killed' and bystander-hit 3D events to screen coords for HTML score popups */
function KillProjector() {
  const { camera, size } = useThree()
  const vec = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const emitAt = (position: { x: number; y: number; z: number }, popup: { multiplier: number; score: number; label?: string; big?: true }) => {
      vec.set(position.x, position.y, position.z).project(camera)
      const screenX = ((vec.x + 1) / 2) * size.width
      const screenY = ((-vec.y + 1) / 2) * size.height
      eventBus.emit('score-popup:screen', { screenX, screenY, ...popup })
    }
    const onKilled = (data: unknown) => {
      const d = data as EnemyKilledEvent
      emitAt(d.position, { multiplier: d.multiplier, score: d.score, big: d.big })
    }
    const onBystander = (data: unknown) => {
      const d = data as BystanderHitEvent
      emitAt(d.position, { multiplier: 1, score: -d.penalty, label: bystanderWarning(d.type) })
    }
    eventBus.on('enemy:killed', onKilled)
    eventBus.on(BYSTANDER_HIT_EVENT, onBystander)
    return () => {
      eventBus.off('enemy:killed', onKilled)
      eventBus.off(BYSTANDER_HIT_EVENT, onBystander)
    }
  }, [camera, size, vec])

  return null
}

function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ]
}

/** The level's world chunk (#862), for the loading screen to fetch as soon as this chunk is in; a failed one is forgotten by `SceneManager`'s boundary. */
export { forgetWorldFailures, loadWorld }

/**
 * A level's whole scene, in its own lazy chunk (#376) so the title's startup JS carries no level code; it suspends
 * until its world's chunk (#862: the biome, its enemies and boss, the level's ride, #960) has arrived too. Only this wrapper suspends: the
 * scene's hooks live in `LevelWorld`, which renders with its world in hand.
 */
export default function LevelScene({ levelId }: { levelId: string }) {
  const config = getLevelConfig(levelId)
  if (!config) return null
  const world = loadedWorld(config.biome) ?? use(loadWorld(config.biome))
  const ride = levelRide(levelId)
  if (!ride) throw new Error(`${levelId}: no ride in the registry or its world's chunk (LevelConfig.ride, World.rides)`)
  return <LevelWorld levelId={levelId} config={config} ride={ride} world={world} />
}

function LevelWorld({ levelId, config, ride, world }: { levelId: string; config: LevelConfig; ride: LevelRide; world: World }) {
  const { environment, biome, enemies, combat, boss, pickups, goldenBalloons } = config
  const { track, walls, seaArch } = ride
  const def = world.biome
  const bossOnly = useGameStore((s) => s.runMode.mode === 'bossRush')
  useEffect(() => {
    if (!isE2E) return
    e2eRide.beats = track.rideV2?.beats ?? []
    return () => {
      e2eRide.beats = []
    }
  }, [track])

  const curve = useMemo(() => createTrackCurve(track), [track])

  const trackDims = useMemo(() => getTrackDimensions(track), [track])
  const trackTable = useMemo(
    () =>
      withBackwards(withDarkSections(withTunnels(buildArcTable(curve), track.tunnels, trackDims.trackScale), track.darkSections), track.mechanics),
    [curve, track.tunnels, track.darkSections, track.mechanics, trackDims],
  )
  const pointAt = useMemo(() => (t: number) => curve.getPointAt(t), [curve])
  const trackSamples = useMemo(() => sampleTrackPath((t) => curve.getPointAt(t)), [curve])
  const heightFn = useMemo(() => groundOf(biome, def, trackSamples), [biome, def, trackSamples])
  const groundFn = useMemo(
    () => createTerrainSurface(heightFn, getTerrainMeshSize(biome)),
    [heightFn, biome],
  )

  const keepOff = useMemo(() => def.keepOff?.(groundFn, trackTable), [def, groundFn, trackTable])
  const clearAir = useMemo(() => def.clearAir?.(groundFn, trackTable), [def, groundFn, trackTable])
  const clearGround = useMemo(() => def.clearGround?.(groundFn, trackTable), [def, groundFn, trackTable])
  const speeds = useMemo(() => rideModel(track, trackTable), [track, trackTable])
  const hardRoute = useMemo(() => hardRouteFor(curve, track.mechanics), [curve, track.mechanics])
  useEffect(() => {
    const hard = track.mechanics && hardRouteOf(curve, track.mechanics)
    setTrackOutline(levelId, hard ? [sampleTrackXZ(curve), sampleTrackXZ(hard)] : [sampleTrackXZ(curve)])
  }, [levelId, curve, track.mechanics])
  const color1 = useMemo(() => hexToRgb(track.color1), [track.color1])
  const color2 = useMemo(() => hexToRgb(track.color2), [track.color2])

  return (
    <WorldContext.Provider value={world}>
      <TerrainContext.Provider value={heightFn}>
        <CoasterCamera
          curve={curve}
          table={trackTable}
          trackScale={trackDims.trackScale}
          speeds={speeds}
          mechanics={track.mechanics}
          heightOffset={trackDims.eyeHeight}
          hero={def.hero}
          groundFn={groundFn}
          bounds={def.bounds}
        />
        <PhotoCamera groundFn={groundFn} bounds={def.bounds} eyeHeight={trackDims.eyeHeight} />
        <ContactShadows groundFn={groundFn}>
          <TrackMesh
            curve={curve}
            color1={color1}
            color2={color2}
            glow={track.glow}
            segments={track.segments}
            dims={trackDims}
            groundFn={groundFn}
            table={trackTable}
            mechanics={track.mechanics}
          />
          <BiomeEnvironment
            biome={biome}
            groundFn={groundFn}
            track={trackTable}
            speeds={speeds}
            darkSections={track.darkSections}
            weather={levelWeather(enemies)?.kind}
            seaArch={seaArch}
            whale={environment.whale}
            hasWater={environment.hasWater}
            hasTrees={environment.hasTrees}
            treeCount={environment.treeCount}
          />
        </ContactShadows>
        <BulletPool bulletColor={combat?.bulletColor} bulletSize={combat?.bulletSize} />
        <ParticleExplosionPool />
        <Pickups levelId={levelId} ids={pickups} pointAt={pointAt} trackScale={trackDims.trackScale} />
        {/* Before EnemySpawner: its mount effect announces the first wave, and the
            stinger listener must already be subscribed. */}
        <LevelAudio />
        <EnemySpawner
          waves={bossOnly ? NO_WAVES : enemies}
          goldenBalloonCount={bossOnly ? 0 : goldenBalloons}
          trackTable={trackTable}
          groundFn={groundFn}
          boss={boss}
          rideSpeeds={speeds}
          trackScale={trackDims.trackScale}
          walls={walls}
          bounds={def.bounds}
          keepOff={keepOff}
          clearAir={clearAir}
          clearGround={clearGround}
          hardRoute={hardRoute}
          darkSections={track.darkSections}
        />
        <ShootingController />
        <GameTimer />
        <KillProjector />
        <ShaderWarmup levelId={levelId} />
      </TerrainContext.Provider>
    </WorldContext.Provider>
  )
}
