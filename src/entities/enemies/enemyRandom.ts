import { useMemo } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { createRng, hashString, type Rng } from '@/utils/rng'

/**
 * An enemy's own random draws (speeds, headings, phases, colour), from a stream seeded by the run
 * seed and its id, so the same run moves the same way on every machine. `draw` runs once per
 * mount; return the `rng` too when the enemy keeps drawing from it as it moves.
 */
export function useEnemyRandom<T>(id: string, draw: (rng: Rng) => T): T {
  const runSeed = useGameStore((s) => s.runSeed)
  // `draw` is a fresh closure each render; the stream depends only on the run and the enemy.
  return useMemo(() => draw(createRng(runSeed ^ hashString(`enemy:${id}`))), [runSeed, id])
}
