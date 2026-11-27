import { SCORE_VALUES } from '@/levels/scoring'
import type { BossType } from '@/types/level'
import type { BossSpec, WeakPointSpec } from './bossModel'
import { KRAKEN_HEAD, KRAKEN_TENTACLE } from './krakenMotion'
import { MEDUSA_SIZE, SNAKE_SLOTS } from './medusaMotion'
import { SCORPION_TAIL } from './scorpionMotion.hot'
import { TITAN_BODY } from './titanMotion.hot'
import { YETI_BODY } from './yetiMotion.hot'

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

/**
 * The envelope's radius at local x: a blunt nose and a long taper to a pointed tail, never wider than `hullR`.
 * 0 off the ends.
 */
export function blimpHullRadius(x: number): number {
  const { hullX, hullRx, hullR } = BLIMP_LAYOUT
  const u = (x - hullX) / hullRx
  if (Math.abs(u) >= 1) return 0
  const round = 1 - u * u
  return hullR * (u >= 0 ? Math.sqrt(round) : round ** 0.75)
}

/** 5× a balloon, like EnemySpawner's bonus golden balloons. */
const GOLDEN_BALLOON_SCORE = SCORE_VALUES.balloon * 5

const blimpBalloons: WeakPointSpec[] = BLIMP_LAYOUT.balloons.map(([x, y], i) => ({
  id: `balloon-${i}`,
  radius: 62,
  offset: [x, y, 0],
  hp: 4,
  score: GOLDEN_BALLOON_SCORE,
  phase: 0,
}))

export const GOLDEN_BLIMP: BossSpec = {
  name: 'The Golden Blimp',
  tell: { seconds: 2, label: 'The Golden Blimp!' },
  reward: 400,
  weakPoints: [
    ...blimpBalloons,
    { id: 'gondola', radius: 60, offset: [BLIMP_LAYOUT.hullX, BLIMP_LAYOUT.gondolaY, 0], hp: 6, score: 0, phase: 1 },
  ],
}

/** Placed every frame on its tentacle (Kraken.tsx), so no offset. */
const krakenPads: WeakPointSpec[] = Array.from({ length: KRAKEN_TENTACLE.count }, (_, i) => ({
  id: `pad-${i}`,
  radius: 40,
  offset: [0, 0, 0],
  hp: 4,
  score: 60,
  phase: 0,
}))

/**
 * The pads first (each shut while its arm slams, `padShut`, #1059), then the eye. Hp for a fight of 12 s or more at the pacing
 * step's `PLAYER_HITS_PER_SECOND`.
 */
export const KRAKEN: BossSpec = {
  name: 'The Kraken',
  tell: { seconds: 2, label: 'The Kraken Rises!' },
  reward: 400,
  weakPoints: [...krakenPads, { id: 'eye', radius: KRAKEN_HEAD.eyeRadius, offset: [0, 0, 0], hp: 7, score: 0, phase: 1 }],
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

/** Claws 3 and the stinger 5, each open only in its moment of the strike (`scorpionShut`): ~7 s on level 2 (#1059), all the final stretch frames before the lift turns the view away. */
const scorpionClaw = (id: string): WeakPointSpec => ({ id, radius: 80, offset: [0, 0, 0], hp: 3, score: 60, phase: 0 })

export const GIANT_SCORPION: BossSpec = {
  name: 'The Giant Scorpion',
  tell: { seconds: 2.5, label: 'Something Stirs Beneath!' },
  reward: 400,
  weakPoints: [
    scorpionClaw('claw-l'),
    scorpionClaw('claw-r'),
    ...scorpionTail,
    { id: 'stinger', radius: 62, offset: [0, 0, 0], hp: 5, score: 0, phase: 1 },
  ],
}

/** Placed every frame at the ends of its arms (Yeti.tsx); the chest on its body. Fists 8 and chest 6 keep it fighting ~14 s (#1059). */
const yetiFist = (id: string): WeakPointSpec => ({ id, radius: 85, offset: [0, 0, 0], hp: 8, score: 60, phase: 0 })

/** Snowballs: a 20-point kill each; ~11 fit in its 20 s fight, the cap is what the server allows. */
export const YETI_SNOWBALL = { score: 20, max: 16, radius: 65 } as const

export const YETI: BossSpec = {
  name: 'The Yeti',
  tell: { seconds: 2.5, label: 'A Roar From The Ridge!' },
  reward: 400,
  weakPoints: [
    yetiFist('fist-l'),
    yetiFist('fist-r'),
    { id: 'chest', radius: 95, offset: [...YETI_BODY.chest], hp: 6, score: 0, phase: 1 },
  ],
  projectiles: { score: YETI_SNOWBALL.score, max: YETI_SNOWBALL.max },
}

const titanVent = (id: string, side: 1 | -1): WeakPointSpec => {
  const [x, y, z] = TITAN_BODY.vent
  return { id, radius: 105, offset: [side * x, y, z], hp: 3, score: 60, phase: 0 }
}

/**
 * The vents and the heart first, then the crown: the heart open only on the beat and the vents shut while it is (`titanShut`,
 * #1059). Hp for a fight of 12 s or more at the pacing step's `PLAYER_HITS_PER_SECOND`.
 */
export const MAGMA_TITAN: BossSpec = {
  name: 'The Magma Titan',
  tell: { seconds: 3, label: 'Final Eruption!' },
  reward: 500,
  weakPoints: [
    titanVent('vent-l', 1),
    titanVent('vent-r', -1),
    { id: 'heart', radius: 115, offset: [...TITAN_BODY.heart], hp: 6, score: 60, phase: 0 },
    { id: 'crown', radius: 120, offset: [...TITAN_BODY.crown], hp: 12, score: 0, phase: 1 },
  ],
}

/** Placed every frame at the head of its snake (Medusa.tsx), so no offset; the crown snake (the last slot) is bigger. */
const medusaSnakes: WeakPointSpec[] = SNAKE_SLOTS.map((s, i) =>
  s.phase === 2
    ? { id: 'crown', radius: 58 * MEDUSA_SIZE, offset: [0, 0, 0], hp: 12, score: 0, phase: 2 }
    : { id: `snake-${i}`, radius: 42 * MEDUSA_SIZE, offset: [0, 0, 0], hp: s.phase === 0 ? 3 : 2, score: 50, phase: s.phase },
)

/**
 * Four snakes, four more, then the crown snake: shoot every snake in her hair, each only as it strikes (`snakeShut`, #1059).
 * Hp for a fight of 12 s or more at the pacing step's `PLAYER_HITS_PER_SECOND`.
 */
export const MEDUSA: BossSpec = {
  name: 'Medusa',
  tell: { seconds: 2.5, label: 'The Starr Awakens!' },
  reward: 500,
  weakPoints: medusaSnakes,
}

/** Local frame: +z = nose, +y up; the root is the cabin's centre. */
export const HELI_LAYOUT = {
  searchlight: [0, -40, 72],
  tailRotor: [18, 22, -238],
  hub: [0, 62, 0],
  rotorRadius: 200,
  rotorY: 70,
} as const

/** The searchlight and the tail rotor first, then the main rotor's hub brings it down. */
export const HELICOPTER: BossSpec = {
  name: 'The Helicopter',
  tell: { seconds: 2.5, label: 'Searchlight Incoming!' },
  reward: 400,
  weakPoints: [
    { id: 'searchlight', radius: 36, offset: [...HELI_LAYOUT.searchlight], hp: 3, score: 60, phase: 0 },
    { id: 'tail-rotor', radius: 42, offset: [...HELI_LAYOUT.tailRotor], hp: 3, score: 60, phase: 0 },
    { id: 'hub', radius: 40, offset: [...HELI_LAYOUT.hub], hp: 12, score: 0, phase: 1 },
  ],
}

export const BOSS_SPECS: Record<BossType, BossSpec> = {
  goldenBlimp: GOLDEN_BLIMP,
  kraken: KRAKEN,
  giantScorpion: GIANT_SCORPION,
  yeti: YETI,
  magmaTitan: MAGMA_TITAN,
  medusa: MEDUSA,
  helicopter: HELICOPTER,
}
