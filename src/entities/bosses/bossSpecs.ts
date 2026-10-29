import { SCORE_VALUES } from '@/levels/scoring'
import type { BossType } from '@/types/level'
import type { BossSpec, WeakPointSpec } from './bossModel'

/** Golden Blimp layout, local frame: +x = nose (the drift direction), y = up; the root sits near the middle of hull + tow chain. */
export const BLIMP_LAYOUT = {
  hullX: 250,
  /** Envelope half-length / radius. */
  hullRx: 220,
  hullR: 68,
  gondolaY: -96,
  balloonScale: 1.8,
  /** Tow chain behind the tail: x and the droop of each golden balloon. */
  balloons: [
    [-60, -20],
    [-195, -50],
    [-330, -80],
    [-465, -110],
    [-600, -140],
  ] as const,
} as const

/** Golden balloons are worth 5× a balloon (EnemySpawner's bonus balloons). */
const GOLDEN_BALLOON_SCORE = SCORE_VALUES.balloon * 5

const blimpBalloons: WeakPointSpec[] = BLIMP_LAYOUT.balloons.map(([x, y], i) => ({
  id: `balloon-${i}`,
  radius: 62,
  offset: [x, y, 0],
  hp: 2,
  score: GOLDEN_BALLOON_SCORE,
  phase: 0,
}))

export const GOLDEN_BLIMP: BossSpec = {
  name: 'The Golden Blimp',
  tell: { seconds: 2, label: 'The Golden Blimp!' },
  reward: 400,
  weakPoints: [
    ...blimpBalloons,
    { id: 'gondola', radius: 60, offset: [BLIMP_LAYOUT.hullX, BLIMP_LAYOUT.gondolaY, 0], hp: 3, score: 0, phase: 1 },
  ],
}

export const BOSS_SPECS: Record<BossType, BossSpec> = {
  goldenBlimp: GOLDEN_BLIMP,
}
