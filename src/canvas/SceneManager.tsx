import { useMemo } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import TrackMesh from '@/track/TrackMesh'
import { getTrackDimensions } from '@/track/trackDimensions'
import { buildArcTable } from '@/track/arcLength'
import CoasterCamera from '@/track/CoasterCamera'
import BiomeEnvironment from '@/levels/environments/BiomeEnvironment'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import ContactShadows from '@/levels/environments/shared/ContactShadows'
import {
  createHeightFunction,
  createTerrainSurface,
  getTerrainMeshSize,
  sampleTrackPath,
} from '@/utils/terrainNoise'
import BulletPool from '@/combat/projectiles/BulletPool'
import ParticleExplosionPool from '@/effects/ParticleExplosion'
import EnemySpawner from '@/entities/spawning/EnemySpawner'
import ShootingController from './ShootingController'
import GameTimer from './GameTimer'
import ShaderWarmup from './ShaderWarmup'
import MusicController from './MusicController'
import TitleScene from './TitleScene'
import PostEffects, { type BloomSettings } from './post/PostEffects'
import { TITLE_GRADE } from './post/colourGrade'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import { eventBus } from '@/core/EventBus'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Projects 'enemy:killed' 3D events to screen coords for HTML score popups */
function KillProjector() {
  const { camera, size } = useThree()
  const vec = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const handler = (data: unknown) => {
      const d = data as { position: THREE.Vector3; combo: number; score: number }
      vec.copy(d.position).project(camera)
      const screenX = ((vec.x + 1) / 2) * size.width
      const screenY = ((-vec.y + 1) / 2) * size.height
      eventBus.emit('enemy:killed:screen', {
        screenX,
        screenY,
        combo: d.combo,
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

function LevelScene({ levelId }: { levelId: string }) {
  const config = getLevelConfig(levelId)
  if (!config) return null

  const { track, environment, biome, enemies, timerSeconds, combat } = config

  const curve = useMemo(() => {
    const factory = track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
    return factory(track.varA, track.varB, track.varC, track.scalar)
  }, [track])

  const trackTable = useMemo(() => buildArcTable(curve), [curve])
  const trackSamples = useMemo(() => sampleTrackPath((t) => curve.getPointAt(t)), [curve])
  const heightFn = useMemo(() => createHeightFunction(biome, trackSamples), [biome, trackSamples])
  const groundFn = useMemo(
    () => createTerrainSurface(heightFn, getTerrainMeshSize(biome)),
    [heightFn, biome],
  )

  const trackDims = useMemo(() => getTrackDimensions(track), [track])
  const color1 = useMemo(() => hexToRgb(track.color1), [track.color1])
  const color2 = useMemo(() => hexToRgb(track.color2), [track.color2])

  return (
    <TerrainContext.Provider value={heightFn}>
      <CoasterCamera
        curve={curve}
        trackLength={trackTable.length}
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
      {/* Before EnemySpawner: its mount effect announces the first wave, and the
          stinger listener must already be subscribed. */}
      <MusicController />
      <EnemySpawner
        waves={enemies}
        goldenBalloonCount={biome === 'themePark' ? 3 : 0}
        trackSamples={trackSamples}
      />
      <ShootingController />
      <GameTimer seconds={timerSeconds} />
      <KillProjector />
      <ShaderWarmup levelId={levelId} />
    </TerrainContext.Provider>
  )
}

const LEVEL_BLOOM: BloomSettings = { threshold: 0.9, intensity: 0.6 }
const TITLE_BLOOM: BloomSettings = { threshold: 0.8, intensity: 0.8 }

export default function SceneManager() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)

  const level = phase === 'title' || phase === 'levelSelect' || !currentLevel ? null : currentLevel
  const biome = level ? getLevelConfig(level)?.biome : undefined

  return (
    <>
      {level ? <LevelScene levelId={level} /> : <TitleScene />}
      {/* Keyed so a bloom change remounts the composer; a biome change only updates grade uniforms */}
      <PostEffects
        key={level ? 'level' : 'title'}
        bloom={level ? LEVEL_BLOOM : TITLE_BLOOM}
        grade={biome ? ATMOSPHERES[biome].grade : TITLE_GRADE}
      />
    </>
  )
}
