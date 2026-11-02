import { SCORE_VALUES } from '@/levels/scoring'
import type { BossType } from '@/types/level'
import type { BossSpec, WeakPointSpec } from './bossModel'
import { KRAKEN_TENTACLE } from './krakenMotion'

/** Local frame: +x = nose; the root sits near the middle of hull + tow chain. */
export const BLIMP_LAYOUT = {
  hullX: 250,
  hullRx: 220,
  hullR: 68,
  gondolaY: -96,
  balloonScale: 1.8,
  /** [x, y] of each towed balloon. */
  balloons: [
    [-60, -20],
    [-195, -50],
    [-330, -80],
    [-465, -110],
    [-600, -140],
  ] as const,
} as const

/** 5× a balloon, like EnemySpawner's bonus golden balloons. */
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

/** Placed every frame on its tentacle (Kraken.tsx), so no offset. */
const krakenPads: WeakPointSpec[] = Array.from({ length: KRAKEN_TENTACLE.count }, (_, i) => ({
  id: `pad-${i}`,
  radius: 40,
  offset: [0, 0, 0],
  hp: 2,
  score: 60,
  phase: 0,
}))

export const KRAKEN: BossSpec = {
  name: 'The Kraken',
  tell: { seconds: 2, label: 'The Kraken Rises!' },
  reward: 400,
  weakPoints: [...krakenPads, { id: 'eye', radius: 44, offset: [0, 0, 0], hp: 3, score: 0, phase: 1 }],
}

export const BOSS_SPECS: Record<BossType, BossSpec> = {
  goldenBlimp: GOLDEN_BLIMP,
  kraken: KRAKEN,
}
