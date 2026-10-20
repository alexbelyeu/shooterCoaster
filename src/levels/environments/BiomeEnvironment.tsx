import { useMemo, useRef, useEffect, useContext } from 'react'
import type * as THREE from 'three'
import { ATMOSPHERES } from './atmosphere'
import type { BiomeType } from '@/types/level'
import {
  getTerrainMeshSize,
  TERRAIN_MESH_SEGMENTS,
  type HeightFunction,
  type TrackSample,
} from '@/utils/terrainNoise'
import { TerrainContext } from './TerrainContext'
import { BIOMES } from './biomeRegistry'
import Atmosphere from './shared/Atmosphere'
import OceanWater from './shared/OceanWater'
import TreeField from './shared/TreeField'
import { createNoiseTerrain } from './shared/terrainMesh'

interface BiomeEnvironmentProps {
  biome: BiomeType
  groundColor: number
  hasWater?: boolean
  hasTrees?: boolean
  treeCount?: number
  groundFn: HeightFunction
  trackSamples: TrackSample[]
}

/**
 * Thin host for one biome: shared atmosphere + terrain + water + trees, then the
 * biome's own Decorations and Features from `biomeRegistry.ts`
 * (`biomes/<biome>/`). Per-biome code never goes in this file.
 */
export default function BiomeEnvironment({
  biome,
  hasWater = false,
  hasTrees = false,
  treeCount = 0,
  groundFn,
  trackSamples,
}: BiomeEnvironmentProps) {
  const atmosphere = ATMOSPHERES[biome]
  const def = BIOMES[biome]
  const heightFn = useContext(TerrainContext)
  const fogRef = useRef<THREE.Fog>(null)

  const groundGeo = useMemo(() => {
    return createNoiseTerrain(def.colorRamp, heightFn, getTerrainMeshSize(biome), TERRAIN_MESH_SEGMENTS)
  }, [biome, def, heightFn])

  useEffect(() => {
    return () => groundGeo.dispose()
  }, [groundGeo])

  const { Decorations, Features } = def

  return (
    <>
      <Atmosphere atmosphere={atmosphere} fogRef={fogRef} />

      {/* Terrain mesh */}
      <mesh geometry={groundGeo}>
        <meshPhongMaterial vertexColors flatShading />
      </mesh>

      {/* Water (ocean level) */}
      {hasWater && <OceanWater />}

      {/* Trees */}
      {hasTrees && treeCount > 0 && def.trees && (
        <TreeField count={treeCount} config={def.trees} heightFn={heightFn} />
      )}

      {/* Biome-specific InstancedMesh decorations */}
      {Decorations && (
        <Decorations heightFn={heightFn} groundFn={groundFn} trackSamples={trackSamples} />
      )}

      {/* Biome landmarks, terrain features and events */}
      {Features && <Features heightFn={heightFn} atmosphere={atmosphere} fogRef={fogRef} />}
    </>
  )
}
