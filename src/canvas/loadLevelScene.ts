import { markStartup } from '@/core/startupMarks'
import { importWithRetry, lazyChunk } from '@/core/staleBuild'

/**
 * The level core's chunk (#376): the scene, track, combat, spawning and the enemies' shared assets, what every world
 * runs on. Fetched once, at startup under the poster (`GameCanvas`' poster handoff, #597), or when a run starts if
 * that fetch failed every retry (forgotten, so the next call fetches afresh, #823).
 */
export const loadLevelScene = lazyChunk(() =>
  importWithRetry(() => import('./LevelScene')).then((mod) => {
    markStartup('levelChunk')
    return mod
  }),
)
