/**
 * Medals (#879): three named feats per level, the reason to ride a 3-star level again. Each is a predicate over the
 * run's stats (`MedalRun`, read from the game store as the run ends); a campaign run's medals are saved per level
 * (`savedMedals`, `savedMedals.ts`), a daily earns none. Pure: no React, three.js or store imports. A new level adds its
 * three here. Only the lazy results and level select screens import it, so the table stays out of the startup JS.
 */
import type { Route } from '@/track/mechanics'

/** What a run did that medals read. */
export interface MedalRun {
  kills: number
  shotsFired: number
  hits: number
  bestCombo: number
  /** Bystanders hit this run. */
  bystandersHit: number
  route: Route
  /** Theme Park's bonus golden balloons popped. */
  goldens: number
  /** Shots fired and hits made while a FRENZY's slow-mo is on. */
  frenzyShots: number
  frenzyHits: number
  /** Game seconds from the boss's arrival to its defeat; null when it wasn't beaten. */
  bossSeconds: number | null
}

export type Feat =
  | { kind: 'goldens'; count: number }
  | { kind: 'boss'; seconds: number }
  | { kind: 'combo'; count: number }
  | { kind: 'frenzyClean' }
  | { kind: 'accuracy'; percent: number; minShots: number }
  /** The hard way round (a junction's switch shot) with no bystander hit. */
  | { kind: 'cleanRoute' }

export interface Medal {
  id: string
  name: string
  /** What to do, in the showman's voice. */
  line: string
  feat: Feat
}

export const NO_RUN: MedalRun = {
  kills: 0,
  shotsFired: 0,
  hits: 0,
  bestCombo: 0,
  bystandersHit: 0,
  route: 'easy',
  goldens: 0,
  frenzyShots: 0,
  frenzyHits: 0,
  bossSeconds: null,
}

const medal = (id: string, name: string, line: string, feat: Feat): Medal => ({ id, name, line, feat })

export const LEVEL_MEDALS: Readonly<Record<string, readonly [Medal, Medal, Medal]>> = {
  level1: [
    medal('goldRush', 'Gold Rush', 'Pop all 3 golden balloons', { kind: 'goldens', count: 3 }),
    medal('blimpBuster', 'Blimp Buster', 'Bring the Golden Blimp down in 12 seconds', { kind: 'boss', seconds: 12 }),
    medal('hotStreak', 'Hot Streak', 'Chain 20 hits in a row', { kind: 'combo', count: 20 }),
  ],
  level2: [
    medal('scorpionWrangler', 'Scorpion Wrangler', 'Beat the Giant Scorpion in 14 seconds', { kind: 'boss', seconds: 14 }),
    medal('deadEye', 'Dead Eye', 'Hit 7 shots in 10, firing 30 or more', { kind: 'accuracy', percent: 70, minShots: 30 }),
    medal('sandstorm', 'Sandstorm', 'Chain 25 hits in a row', { kind: 'combo', count: 25 }),
  ],
  level3: [
    medal('krakenTamer', 'Kraken Tamer', 'Beat the Kraken in 14 seconds', { kind: 'boss', seconds: 14 }),
    medal('steadyHand', 'Steady Hand', 'Miss nothing through a Frenzy', { kind: 'frenzyClean' }),
    medal('tidalChain', 'Tidal Chain', 'Chain 25 hits in a row', { kind: 'combo', count: 25 }),
  ],
  level4: [
    medal('yetiHunter', 'Yeti Hunter', 'Beat the Yeti in 14 seconds', { kind: 'boss', seconds: 14 }),
    medal('coldEye', 'Cold Eye', 'Hit 3 shots in 4, firing 30 or more', { kind: 'accuracy', percent: 75, minShots: 30 }),
    medal('avalanche', 'Avalanche', 'Chain 25 hits in a row', { kind: 'combo', count: 25 }),
  ],
  level5: [
    medal('titanBreaker', 'Titan Breaker', 'Beat the Magma Titan in 15 seconds', { kind: 'boss', seconds: 15 }),
    medal('coolHead', 'Cool Head', 'Miss nothing through a Frenzy', { kind: 'frenzyClean' }),
    medal('firestorm', 'Firestorm', 'Chain 30 hits in a row', { kind: 'combo', count: 30 }),
  ],
  level6: [
    medal('cleanClimb', 'Clean Climb', 'Take the V8 way round and hit no climber', { kind: 'cleanRoute' }),
    medal('snakeCharmer', 'Snake Charmer', 'Beat Medusa in 15 seconds', { kind: 'boss', seconds: 15 }),
    medal('ratRace', 'Rat Race', 'Chain 20 hits in a row', { kind: 'combo', count: 20 }),
  ],
  level7: [
    medal('chopperDown', 'Chopper Down', 'Ground the Helicopter in 12 seconds', { kind: 'boss', seconds: 12 }),
    medal('neonEye', 'Neon Eye', 'Hit 3 shots in 4, firing 30 or more', { kind: 'accuracy', percent: 75, minShots: 30 }),
    medal('gridlock', 'Gridlock', 'Chain 25 hits in a row', { kind: 'combo', count: 25 }),
  ],
}

/** The longest combo any medal asks for: a chain this long wins every combo medal (the smoke primes it). */
export const LONGEST_COMBO_MEDAL = Math.max(
  ...Object.values(LEVEL_MEDALS).flatMap((ms) => ms.map((m) => (m.feat.kind === 'combo' ? m.feat.count : 0))),
)

export function levelMedals(levelId: string): readonly Medal[] {
  return LEVEL_MEDALS[levelId] ?? []
}

export function featMet(feat: Feat, run: MedalRun): boolean {
  switch (feat.kind) {
    case 'goldens':
      return run.goldens >= feat.count
    case 'boss':
      return run.bossSeconds !== null && run.bossSeconds <= feat.seconds
    case 'combo':
      return run.bestCombo >= feat.count
    case 'frenzyClean':
      return run.frenzyShots > 0 && run.frenzyHits >= run.frenzyShots
    case 'accuracy':
      return run.shotsFired >= feat.minShots && run.hits * 100 >= feat.percent * run.shotsFired
    case 'cleanRoute':
      return run.route === 'hard' && run.bystandersHit === 0
  }
}

/** Ids of the level's medals this run won, in the level's order; none for no run (a daily, `store` `medalRun`). */
export function medalsWon(levelId: string, run: MedalRun | null): string[] {
  if (!run) return []
  return levelMedals(levelId)
    .filter((m) => featMet(m.feat, run))
    .map((m) => m.id)
}
