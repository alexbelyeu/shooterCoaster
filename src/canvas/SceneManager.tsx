import { useMemo } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createTrigCurve } from '@/track/curves/TrigCurve'
import { createTrigCurve2 } from '@/track/curves/TrigCurve2'
import TrackMesh from '@/track/TrackMesh'
import CoasterCamera from '@/track/CoasterCamera'
import BiomeEnvironment from '@/levels/environments/BiomeEnvironment'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import { createHeightFunction, sampleTrackPath } from '@/utils/terrainNoise'
import BulletPool from '@/combat/projectiles/BulletPool'
import ParticleExplosionPool from '@/effects/ParticleExplosion'
import EnemySpawner from '@/entities/spawning/EnemySpawner'
import ShootingController from './ShootingController'
import GameTimer from './GameTimer'
import MusicController from './MusicController'
import TitleScene from './TitleScene'
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
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

  const { track, environment, biome, enemies, timerSeconds } = config

  const curve = useMemo(() => {
    const factory = track.curve === 'curve2' ? createTrigCurve2 : createTrigCurve
    return factory(track.varA, track.varB, track.varC, track.scalar)
  }, [track])

  const trackSamples = useMemo(() => sampleTrackPath((t) => curve.getPointAt(t)), [curve])
  const heightFn = useMemo(() => createHeightFunction(biome, trackSamples), [biome, trackSamples])

  const color1 = useMemo(() => hexToRgb(track.color1), [track.color1])
  const color2 = useMemo(() => hexToRgb(track.color2), [track.color2])

  // Determine bullet appearance based on level
  const bulletColor = levelId === 'level4' ? '#000000' : '#ff0000'
  const bulletSize = levelId === 'level4' ? 40 : 10

  return (
    <TerrainContext.Provider value={heightFn}>
      <CoasterCamera
        curve={curve}
        rollerSpeed={track.rollerSpeed}
        minRollerSpeed={track.minRollerSpeed}
      />
      <TrackMesh curve={curve} color1={color1} color2={color2} />
      <BiomeEnvironment
        biome={biome}
        groundColor={environment.groundColor}
        hasWater={environment.hasWater}
        hasTrees={environment.hasTrees}
        treeCount={environment.treeCount}
      />
      <BulletPool bulletColor={bulletColor} bulletSize={bulletSize} />
      <ParticleExplosionPool />
      <EnemySpawner waves={enemies} goldenBalloonCount={biome === 'themePark' ? 3 : 0} />
      <ShootingController />
      <GameTimer seconds={timerSeconds} />
      <MusicController />
      <KillProjector />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.9}
          luminanceSmoothing={0.4}
          intensity={0.6}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.4} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </TerrainContext.Provider>
  )
}

export default function SceneManager() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)

  if (phase === 'title' || phase === 'levelSelect') {
    return (
      <>
        <TitleScene />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.8}
            luminanceSmoothing={0.4}
            intensity={0.8}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </>
    )
  }

  if (currentLevel && (phase === 'playing' || phase === 'paused' || phase === 'results')) {
    return <LevelScene levelId={currentLevel} />
  }

  return (
    <>
      <TitleScene />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.4}
          intensity={0.8}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
