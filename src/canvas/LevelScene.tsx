import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import TrackMesh from '@/track/TrackMesh'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import { withTunnels } from '@/track/setPieces'
import CoasterCamera from '@/track/CoasterCamera'
import { rideModel } from '@/track/ridePhysics'
import BiomeEnvironment from '@/levels/environments/BiomeEnvironment'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { BIOMES, biomeHeightFunction } from '@/levels/environments/biomeRegistry'
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
import { hardRouteFor } from '@/track/mechanics'
import { goldenBalloonCount } from '@/levels/scoring'
import { eventBus } from '@/core/EventBus'
import { BYSTANDER_HIT_EVENT, bystanderWarning, type BystanderHitEvent } from '@/combat/bystanders'
import ShootingController from './ShootingController'
import GameTimer from './GameTimer'
import ShaderWarmup from './ShaderWarmup'
import LevelAudio from './LevelAudio'
import { levelWeather } from '@/levels/environments/shared/weatherPulse'

/** Projects 'enemy:killed' and bystander-hit 3D events to screen coords for HTML score popups */
function KillProjector() {
  const { camera, size } = useThree()
  const vec = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const emitAt = (position: { x: number; y: number; z: number }, popup: { multiplier: number; score: number; label?: string }) => {
      vec.set(position.x, position.y, position.z).project(camera)
      const screenX = ((vec.x + 1) / 2) * size.width
      const screenY = ((-vec.y + 1) / 2) * size.height
      eventBus.emit('score-popup:screen', { screenX, screenY, ...popup })
    }
    const onKilled = (data: unknown) => {
      const d = data as { position: THREE.Vector3; multiplier: number; score: number }
      emitAt(d.position, { multiplier: d.multiplier, score: d.score })
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

/** A level's whole scene, in its own lazy chunk (#376) so the title's startup JS carries no level code. */
export default function LevelScene({ levelId }: { levelId: string }) {
  const config = getLevelConfig(levelId)
  if (!config) return null

  const { track, environment, biome, enemies, combat, boss, pickups, walls } = config

  const curve = useMemo(() => createTrackCurve(track), [track])

  const trackDims = useMemo(() => getTrackDimensions(track), [track])
  const trackTable = useMemo(() => withTunnels(buildArcTable(curve), track.tunnels, trackDims.trackScale), [curve, track.tunnels, trackDims])
  const pointAt = useMemo(() => (t: number) => curve.getPointAt(t), [curve])
  const trackSamples = useMemo(() => sampleTrackPath((t) => curve.getPointAt(t)), [curve])
  const heightFn = useMemo(() => biomeHeightFunction(biome, trackSamples), [biome, trackSamples])
  const groundFn = useMemo(
    () => createTerrainSurface(heightFn, getTerrainMeshSize(biome)),
    [heightFn, biome],
  )

  const keepOff = useMemo(() => BIOMES[biome].keepOff?.(groundFn, trackTable), [biome, groundFn, trackTable])
  const speeds = useMemo(() => rideModel(track, trackTable), [track, trackTable])
  const hardRoute = useMemo(() => hardRouteFor(curve, track.mechanics), [curve, track.mechanics])
  const color1 = useMemo(() => hexToRgb(track.color1), [track.color1])
  const color2 = useMemo(() => hexToRgb(track.color2), [track.color2])

  return (
    <TerrainContext.Provider value={heightFn}>
      <CoasterCamera
        curve={curve}
        table={trackTable}
        trackScale={trackDims.trackScale}
        speeds={speeds}
        mechanics={track.mechanics}
        heightOffset={trackDims.eyeHeight}
        hero={BIOMES[biome].hero}
        groundFn={groundFn}
        bounds={BIOMES[biome].bounds}
      />
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
          darkSections={track.darkSections}
          weather={levelWeather(enemies)?.kind}
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
        waves={enemies}
        goldenBalloonCount={goldenBalloonCount(biome)}
        trackTable={trackTable}
        groundFn={groundFn}
        boss={boss}
        rideSpeeds={speeds}
        trackScale={trackDims.trackScale}
        walls={walls}
        bounds={BIOMES[biome].bounds}
        keepOff={keepOff}
        hardRoute={hardRoute}
      />
      <ShootingController />
      <GameTimer />
      <KillProjector />
      <ShaderWarmup levelId={levelId} />
    </TerrainContext.Provider>
  )
}
