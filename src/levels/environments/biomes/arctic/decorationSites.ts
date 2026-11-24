import type { ArcTable } from '@/track/arcLength'
import { createRng } from '@/utils/rng'
import type { HeightFunction } from '@/utils/terrainNoise'
import { scatterPositions } from '../../shared/scatter'
import { buildTrackIndex } from '../../shared/trackClearance'

type Site = { x: number; y: number; z: number }

/** How far (XZ) each prop keeps from the rails and towers; a pond's is its largest radius. */
const BOULDER_CLEAR = 40
const COLUMN_CLEAR = 30
export const POND_MAX_RADIUS = 45

/**
 * Where level 4's boulders, ice columns and frozen ponds stand (#866), pure. Each keeps clear of the track and of what is built
 * over it (`trackClearance.ts`: the ice cave's vault, #911).
 */
export function arcticSites(track: ArcTable, heightFn: HeightFunction): { boulders: Site[]; columns: Site[]; ponds: Site[] } {
  const index = buildTrackIndex(track)
  const clear = (radius: number) => (p: Site) => !index.near(p.x, p.z, radius)
  return {
    boulders: scatterPositions(createRng(2410), 80, 150, 3500, heightFn).filter(clear(BOULDER_CLEAR)),
    columns: scatterPositions(createRng(2411), 45, 200, 3500, heightFn).filter(clear(COLUMN_CLEAR)),
    ponds: scatterPositions(createRng(2412), 20, 150, 3000, heightFn, Math.PI / 6).filter(clear(POND_MAX_RADIUS)),
  }
}
