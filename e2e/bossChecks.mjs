// The boss step's per-level checks (`bossCheck` in smoke.mjs), apart so a unit test can hold them to the levels.

/**
 * The finales the boss check summons: Theme Park's Golden Blimp (#181), Desert's Giant Scorpion (#318),
 * Ocean's Kraken (#183), Antarctica's Yeti (#319), Inferno's Magma Titan (#320) and the Climbing Gym's Medusa (#521). `minOnScreen` first-phase weak points
 * must be on screen after the boss alone has moved `settleS` s (the scorpion bursts out of the sand, the Kraken's tentacles
 * rise out of the water, the Yeti has climbed its ridge and thrown, the Titan has climbed out of the lava and opened its heart); `midSettleS` lets the last phase surface before `midShot`.
 * `firstPhase`: the id prefix(es) of the first phase. `minProjectiles`: thrown things (the Yeti's snowballs) on screen
 * in <level>-boss.png, each then shot through processHit as a normal kill that leaves the boss's hp alone. `midPhases`: phases
 * between the first and the last, each cleared after `midSettleS`. `rideTo`: the track fraction to ride to first, for a boss
 * that stays where it is (the Medusa in the Starr) rather than coming to the rider. `passShots`: track fractions ridden to
 * after `midShot`, each a `<level>-boss-pass-<percent>.png` (the ride past the leant-out Medusa). Both are fractions of the
 * lap, so they move whenever the track is reshaped: `bossChecks.test.ts` holds `rideTo` to the boss's first 4 s on the
 * ride (#769 moved the Medusa from 0.69 to 0.59 of the lap and the step rode on to 0.7, past her) and `passShots` to after it.
 */
export const BOSS_CHECKS = [
  { level: 'level1', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'balloon-', lastPhase: ['gondola'], midShot: 'boss-gondola', minOnScreen: 1, settleS: 0, midSettleS: 0 },
  { level: 'level2', minWidthFrac: 0.15, weakPoints: 7, firstPhase: ['claw-', 'tail-'], lastPhase: ['stinger'], midShot: 'boss-stinger', minOnScreen: 4, settleS: 2, midSettleS: 1 },
  { level: 'level3', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'pad-', lastPhase: ['eye'], midShot: 'boss-head', minOnScreen: 3, settleS: 3, midSettleS: 3 },
  { level: 'level4', minWidthFrac: 0.15, weakPoints: 3, firstPhase: 'fist-', lastPhase: ['chest'], midShot: 'boss-chest', minOnScreen: 2, settleS: 4, midSettleS: 1, minProjectiles: 1 },
  { level: 'level5', minWidthFrac: 0.15, weakPoints: 4, firstPhase: ['vent-', 'heart'], lastPhase: ['crown'], midShot: 'boss-crown', minOnScreen: 3, settleS: 3, midSettleS: 0 },
  { level: 'level6', minWidthFrac: 0.15, weakPoints: 9, firstPhase: 'snake-', midPhases: 1, lastPhase: ['crown'], midShot: 'boss-crown', minOnScreen: 3, settleS: 2, midSettleS: 1, rideTo: 0.59, passShots: [0.627, 0.64] },
]
