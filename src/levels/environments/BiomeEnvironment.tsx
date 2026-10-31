import { useMemo, useRef, useEffect, useContext } from 'react'
import * as THREE from 'three'
import { ATMOSPHERES } from './atmosphere'
import type { BiomeType } from '@/types/level'
import type { ArcTable } from '@/track/arcLength'
import {
  getTerrainMeshSize,
  TERRAIN_MESH_SEGMENTS,
  type HeightFunction,
} from '@/utils/terrainNoise'
import { hashString } from '@/utils/rng'
import { TerrainContext } from './TerrainContext'
import { BIOMES } from './biomeRegistry'
import Atmosphere from './shared/Atmosphere'
import OceanWater from './shared/OceanWater'
import TreeField from './shared/TreeField'
import ParticleField from './shared/ParticleField'
import { addTerrainGlow, createNoiseTerrain, createTerrainMaterial } from './shared/terrainMesh'

interface BiomeEnvironmentProps {
  biome: BiomeType
  /** Terrain as drawn (createTerrainSurface). */
  groundFn: HeightFunction
  track: ArcTable
  hasWater?: boolean
  hasTrees?: boolean
  treeCount?: number
}

/**
 * Thin host for one biome: shared atmosphere + terrain + water + trees, then the
 * biome's own Decorations and Features from `biomeRegistry.ts`
 * (`biomes/<biome>/`). Per-biome code never goes in this file.
 */
export default function BiomeEnvironment({
  biome,
  groundFn,
  track,
  hasWater = false,
  hasTrees = false,
  treeCount = 0,
}: BiomeEnvironmentProps) {
  const atmosphere = ATMOSPHERES[biome]
  const def = BIOMES[biome]
  const heightFn = useContext(TerrainContext)
  const fogRef = useRef<THREE.Fog>(null)

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
      <Atmosphere atmosphere={atmosphere} fogRef={fogRef} />

      {/* Terrain mesh */}
      <mesh geometry={groundGeo} material={groundMat} />

      {/* Water (ocean level) */}
      {hasWater && <OceanWater atmosphere={atmosphere} />}

      {/* Trees */}
      {hasTrees && treeCount > 0 && def.trees && (
        <TreeField count={treeCount} config={def.trees} heightFn={heightFn} seed={hashString(`trees:${biome}`)} />
      )}

      {/* Biome-specific InstancedMesh decorations */}
      {Decorations && <Decorations heightFn={heightFn} groundFn={groundFn} track={track} atmosphere={atmosphere} />}

      {/* Biome landmarks, terrain features and events */}
      {Features && <Features heightFn={heightFn} groundFn={groundFn} track={track} atmosphere={atmosphere} fogRef={fogRef} />}

      {/* Ambient air particles around the camera */}
      {particles && <ParticleField preset={particles} />}
    </>
  )
}
