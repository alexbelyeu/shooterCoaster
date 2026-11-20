import { useMemo, useRef, useEffect, useContext, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ATMOSPHERES } from './atmosphere'
import type { BiomeType, DarkSectionSpec, WeatherKind } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import type { RideSpeeds } from '@/track/ridePhysics'
import {
  getTerrainMeshSize,
  TERRAIN_MESH_SEGMENTS,
  type HeightFunction,
} from '@/utils/terrainNoise'
import { hashString } from '@/utils/rng'
import { useGameStore } from '@/store/useGameStore'
import { TerrainContext } from './TerrainContext'
import { BIOMES } from './biomeRegistry'
import Atmosphere from './shared/Atmosphere'
import OceanWater from './shared/OceanWater'
import TreeField from './shared/TreeField'
import ParticleField from './shared/ParticleField'
import Weather from './shared/Weather'
import { combineFog, createFogModifiers, resetFogModifiers } from './shared/sceneFog'
import { addTerrainGlow, createNoiseTerrain, createTerrainMaterial } from './shared/terrainMesh'

interface BiomeEnvironmentProps {
  biome: BiomeType
  /** Terrain as drawn (createTerrainSurface). */
  groundFn: HeightFunction
  track: ArcTable
  speeds: RideSpeeds
  /** The track's dark sections (#752), dimming the atmosphere while the rider is in one. */
  darkSections?: readonly DarkSectionSpec[]
  /** The weather its waves bring (#798): fog and driven streaks with the wave. */
  weather?: WeatherKind
  hasWater?: boolean
  hasTrees?: boolean
  treeCount?: number
}

/**
 * Thin host for one biome: shared atmosphere + terrain + water + trees, then the
 * biome's own Decorations and Features from `biomeRegistry.ts`
 * (`biomes/<biome>/`). Per-biome code never goes in this file.
 *
 * It owns the scene fog's near and far: a dark section, the volcanic eruption and the weather each publish a modifier
 * into `fogMods`, combined here once a frame (`combineFog`), and a new run starts them all from the biome's fog.
 */
export default function BiomeEnvironment({
  biome,
  groundFn,
  track,
  speeds,
  darkSections,
  weather,
  hasWater = false,
  hasTrees = false,
  treeCount = 0,
}: BiomeEnvironmentProps) {
  const atmosphere = ATMOSPHERES[biome]
  const def = BIOMES[biome]
  const heightFn = useContext(TerrainContext)
  const fogRef = useRef<THREE.Fog>(null)
  const [fogMods] = useState(createFogModifiers)
  const [fogRange] = useState(() => ({ near: 0, far: 0 }))
  const runId = useGameStore((s) => s.runId)

  useEffect(() => resetFogModifiers(fogMods), [runId, fogMods])

  useFrame(() => {
    const fog = fogRef.current
    if (!fog) return
    combineFog(atmosphere, fogMods, fogRange)
    fog.near = fogRange.near
    fog.far = fogRange.far
    const report = window.__SC_TEST__?.weather
    if (report) {
      report.fogNear = fog.near
      report.fogFar = fog.far
    }
  })

  const groundGeo = useMemo(() => {
    const geo = createNoiseTerrain(def.colorRamp, heightFn, getTerrainMeshSize(biome), TERRAIN_MESH_SEGMENTS)
    if (def.terrainGlow) addTerrainGlow(geo, def.terrainGlow)
    return geo
  }, [biome, def, heightFn])
  const groundMat = useMemo(
    () => def.createTerrainMaterial?.() ?? createTerrainMaterial(def.terrainGlow),
    [def],
  )

  useEffect(() => {
    return () => groundGeo.dispose()
  }, [groundGeo])
  useEffect(() => {
    return () => groundMat.dispose()
  }, [groundMat])

  const { Decorations, Features, particles } = def

  return (
    <>
      <Atmosphere atmosphere={atmosphere} fogRef={fogRef} darkSections={darkSections && { sections: darkSections, fog: fogMods }} />

      {/* Terrain mesh */}
      <mesh geometry={groundGeo} material={groundMat} />

      {/* Water (ocean level) */}
      {hasWater && <OceanWater atmosphere={atmosphere} groundFn={groundFn} terrainSize={getTerrainMeshSize(biome)} />}

      {/* Trees */}
      {hasTrees && treeCount > 0 && def.trees && (
        <TreeField count={treeCount} config={def.trees} heightFn={heightFn} seed={hashString(`trees:${biome}`)} />
      )}

      {/* Biome-specific InstancedMesh decorations */}
      {Decorations && <Decorations heightFn={heightFn} groundFn={groundFn} track={track} atmosphere={atmosphere} />}

      {/* Biome landmarks, terrain features and events */}
      {Features && <Features heightFn={heightFn} groundFn={groundFn} track={track} speeds={speeds} atmosphere={atmosphere} fog={fogMods} />}

      {/* Ambient air particles around the camera */}
      {particles && <ParticleField preset={particles} />}
      {weather && <Weather kind={weather} atmosphere={atmosphere} fog={fogMods} />}
    </>
  )
}
