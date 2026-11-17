export interface ReadyGate {
  shown: boolean
  /** The level scene's lazy chunk (`canvas/loadLevelScene.ts`): until it arrives nothing of the level can draw. */
  chunkLoaded: boolean
  sceneReady: boolean
  /** The warm-up's cap, counted from the chunk's arrival. */
  warmupTimedOut: boolean
}

/** Set may follow Ready (#464): never before the level scene can draw, never later than the warm-up's cap once it can. */
export function readyDone({ shown, chunkLoaded, sceneReady, warmupTimedOut }: ReadyGate): boolean {
  return shown && chunkLoaded && (sceneReady || warmupTimedOut)
}
