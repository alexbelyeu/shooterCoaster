import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import TrackMesh from '@/track/TrackMesh'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import CoasterCamera from '@/track/CoasterCamera'
import { rideSpeeds } from '@/track/ridePhysics'
import BiomeEnvironment from '@/levels/environments/BiomeEnvironment'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { BIOMES } from '@/levels/environments/biomeRegistry'
import ContactShadows from '@/levels/environments/shared/ContactShadows'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  sampleTrackPath,
} from '@/utils/terrainNoise'
import BulletPool from '@/combat/projectiles/BulletPool'
import Pickups from '@/combat/pickups/Pickups'
import ParticleExplosionPool from '@/effects/ParticleExplosion'
import EnemySpawner from '@/entities/spawning/EnemySpawner'
import { goldenBalloonCount } from '@/levels/scoring'
import { RUN_SECONDS } from '@/levels/pacing'
import { eventBus } from '@/core/EventBus'
import ShootingController from './ShootingController'
import GameTimer from './GameTimer'
import ShaderWarmup from './ShaderWarmup'
import LevelAudio from './LevelAudio'

/** Projects 'enemy:killed' 3D events to screen coords for HTML score popups */
function KillProjector() {
  const { camera, size } = useThree()
  const vec = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const handler = (data: unknown) => {
      const d = data as { position: THREE.Vector3; multiplier: number; score: number }
      vec.copy(d.position).project(camera)
      const screenX = ((vec.x + 1) / 2) * size.width
      const screenY = ((-vec.y + 1) / 2) * size.height
      eventBus.emit('enemy:killed:screen', {
        screenX,
        screenY,
        multiplier: d.multiplier,
        score: d.score,
      })
    }
    eventBus.on('enemy:killed', handler)
    return () => eventBus.off('enemy:killed', handler)
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

  const trackTable = useMemo(() => buildArcTable(curve), [curve])
  const pointAt = useMemo(() => (t: number) => curve.getPointAt(t), [curve])
  const trackSamples = useMemo(() => sampleTrackPath((t) => curve.getPointAt(t)), [curve])
  const heightFn = useMemo(() => createHeightFunction(biome, trackSamples, BIOMES[biome].floor), [biome, trackSamples])
  const groundFn = useMemo(
    () => createTerrainSurface(heightFn, getTerrainMeshSize(biome)),
    [heightFn, biome],
  )

  const trackDims = useMemo(() => getTrackDimensions(track), [track])
  const speeds = useMemo(() => rideSpeeds(track), [track])
  const color1 = useMemo(() => hexToRgb(track.color1), [track.color1])
  const color2 = useMemo(() => hexToRgb(track.color2), [track.color2])

  return (
    <TerrainContext.Provider value={heightFn}>
      <CoasterCamera
        curve={curve}
        table={trackTable}
        trackScale={trackDims.trackScale}
        rollerSpeed={track.rollerSpeed}
        minRollerSpeed={track.minRollerSpeed}
        heightOffset={trackDims.eyeHeight}
      />
      <ContactShadows groundFn={groundFn}>
        <TrackMesh
          curve={curve}
          color1={color1}
          color2={color2}
          glow={track.glow}
          dims={trackDims}
          groundFn={groundFn}
          table={trackTable}
        />
        <BiomeEnvironment
          biome={biome}
          groundFn={groundFn}
          track={trackTable}
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
        timerSeconds={RUN_SECONDS}
        rideSpeeds={speeds}
        trackScale={trackDims.trackScale}
        walls={walls}
        bounds={BIOMES[biome].bounds}
      />
      <ShootingController />
      <GameTimer seconds={RUN_SECONDS} />
      <KillProjector />
      <ShaderWarmup levelId={levelId} />
    </TerrainContext.Provider>
  )
}
