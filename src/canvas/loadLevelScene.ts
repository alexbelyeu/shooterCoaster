import { markStartup } from '@/core/startupMarks'
import { lazyChunk } from '@/core/staleBuild'

/**
 * The level core's chunk (#376): the scene, track, combat, spawning and the enemies' shared assets, what every world
 * runs on. Fetched once, at startup under the poster (`GameCanvas`' poster handoff, #597), or when a run starts if
 * that fetch failed (a failure reloads the page, `app/staleReload.ts`, #888).
 */
export const loadLevelScene = lazyChunk(() =>
  import('./LevelScene').then((mod) => {
    markStartup('levelChunk')
    return mod
  }),
)
