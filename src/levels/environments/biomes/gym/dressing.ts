import { wallDressing, type WallDressing } from './gymLayout'

const DRESSING_SEED = 4570

let cached: WallDressing | null = null

/** The walls' holds, volumes and tape: laid out once (fixed seed), shared by `Features` and `Decorations`. */
export function gymDressing(): WallDressing {
  cached ??= wallDressing(DRESSING_SEED)
  return cached
}
