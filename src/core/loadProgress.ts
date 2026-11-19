/**
 * What the loading screen (#674) waits on, reported by the parts doing the work: the level's lazy chunk
 * (`canvas/loadLevelScene.ts`), its scene's mount, the shader warm-up (`canvas/ShaderWarmup.tsx`) and the audio
 * (`canvas/LevelAudio.tsx`: the level's SFX bake and its score started). Reports carry the level they are for, so
 * a level being left can't fill the next one's bar.
 */

export type LoadStage = 'chunk' | 'scene' | 'shaders' | 'audio'

/** Each stage's share of the bar, roughly its share of the wait on a slow device. */
const WEIGHTS: Record<LoadStage, number> = { chunk: 0.15, scene: 0.1, shaders: 0.6, audio: 0.15 }
const STAGES = Object.keys(WEIGHTS) as LoadStage[]

let level: string | null = null
const done: Record<LoadStage, number> = { chunk: 0, scene: 0, shaders: 0, audio: 0 }

/** A new level starts loading: every stage back to 0. */
export function resetLoad(levelId: string | null): void {
  level = levelId
  for (const stage of STAGES) done[stage] = 0
}

/** `stage` of `levelId` is `fraction` (0–1) done; a bar never goes back, and a report for another level is dropped. */
export function reportLoad(levelId: string | null, stage: LoadStage, fraction: number): void {
  if (levelId !== level) return
  done[stage] = Math.max(done[stage], Math.min(Math.max(fraction, 0), 1))
}

/** How far a stage of the loading level has got (0–1). */
export function loadStage(stage: LoadStage): number {
  return done[stage]
}

/** The bar: the stages' weighted progress, 0–1. `skip` stages count as done (audio still locked). */
export function loadFraction(skip?: LoadStage): number {
  let sum = 0
  for (const stage of STAGES) sum += WEIGHTS[stage] * (stage === skip ? 1 : done[stage])
  return sum
}
