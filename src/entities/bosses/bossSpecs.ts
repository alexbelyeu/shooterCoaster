import { SCORE_VALUES } from '@/levels/scoring'
import type { BossType } from '@/types/level'
import type { BossSpec, WeakPointSpec } from './bossModel'
import { KRAKEN_TENTACLE } from './krakenMotion'
import { SCORPION_TAIL } from './scorpionMotion'
import { TITAN_BODY } from './titanMotion'
import { YETI_BODY } from './yetiMotion'

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

/** Placed every frame on its arm or along the tail (GiantScorpion.tsx), so no offset. */
const scorpionTail: WeakPointSpec[] = Array.from({ length: SCORPION_TAIL.segments }, (_, i) => ({
  id: `tail-${i}`,
  radius: 58,
  offset: [0, 0, 0],
  hp: 1,
  score: 40,
  phase: 0,
}))

const scorpionClaw = (id: string): WeakPointSpec => ({ id, radius: 80, offset: [0, 0, 0], hp: 2, score: 60, phase: 0 })

export const GIANT_SCORPION: BossSpec = {
  name: 'The Giant Scorpion',
  tell: { seconds: 2.5, label: 'Something Stirs Beneath!' },
  reward: 400,
  weakPoints: [
    scorpionClaw('claw-l'),
    scorpionClaw('claw-r'),
    ...scorpionTail,
    { id: 'stinger', radius: 62, offset: [0, 0, 0], hp: 3, score: 0, phase: 1 },
  ],
}

/** Placed every frame at the ends of its arms (Yeti.tsx); the chest on its body. */
const yetiFist = (id: string): WeakPointSpec => ({ id, radius: 85, offset: [0, 0, 0], hp: 2, score: 60, phase: 0 })

/** Snowballs: a 20-point kill each; ~11 fit in its 20 s fight, the cap is what the server allows. */
export const YETI_SNOWBALL = { score: 20, max: 16, radius: 65 } as const

export const YETI: BossSpec = {
  name: 'The Yeti',
  tell: { seconds: 2.5, label: 'A Roar From The Ridge!' },
  reward: 400,
  weakPoints: [
    yetiFist('fist-l'),
    yetiFist('fist-r'),
    { id: 'chest', radius: 95, offset: [...YETI_BODY.chest], hp: 4, score: 0, phase: 1 },
  ],
  projectiles: { score: YETI_SNOWBALL.score, max: YETI_SNOWBALL.max },
}

const titanVent = (id: string, side: 1 | -1): WeakPointSpec => {
  const [x, y, z] = TITAN_BODY.vent
  return { id, radius: 105, offset: [side * x, y, z], hp: 2, score: 60, phase: 0 }
}

/** The vents and the heart first (the heart only while it beats its chest open), then the crown. */
export const MAGMA_TITAN: BossSpec = {
  name: 'The Magma Titan',
  tell: { seconds: 3, label: 'Final Eruption!' },
  reward: 500,
  weakPoints: [
    titanVent('vent-l', 1),
    titanVent('vent-r', -1),
    { id: 'heart', radius: 115, offset: [...TITAN_BODY.heart], hp: 2, score: 60, phase: 0 },
    { id: 'crown', radius: 120, offset: [...TITAN_BODY.crown], hp: 4, score: 0, phase: 1 },
  ],
}

export const BOSS_SPECS: Record<BossType, BossSpec> = {
  goldenBlimp: GOLDEN_BLIMP,
  kraken: KRAKEN,
  giantScorpion: GIANT_SCORPION,
  yeti: YETI,
  magmaTitan: MAGMA_TITAN,
}
