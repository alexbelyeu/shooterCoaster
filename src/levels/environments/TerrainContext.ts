import { createContext } from 'react'
import type { HeightFunction } from '@/utils/terrainNoise'

/** Default height function returns flat ground (y = 0) */
const defaultHeightFn: HeightFunction = () => 0

/**
 * React context sharing the terrain height function.
 * Used by TrackMesh for pillar generation and BiomeEnvironment for trees/decorations.
 */
export const TerrainContext = createContext<HeightFunction>(defaultHeightFn)
