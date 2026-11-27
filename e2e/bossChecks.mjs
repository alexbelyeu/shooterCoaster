// The boss step's per-level checks (`bossCheck` in smoke.mjs), apart so a unit test can hold them to the levels.

/**
 * The finales the boss check summons: Theme Park's Golden Blimp (#181), Desert's Giant Scorpion (#318),
 * Ocean's Kraken (#183), Antarctica's Yeti (#319), Inferno's Magma Titan (#320), the Climbing Gym's Medusa (#521) and Neon Metropolis's Helicopter (#325). `minOnScreen` first-phase weak points
 * must be on screen after the boss alone has moved `settleS` s (the scorpion bursts out of the sand, the Kraken's tentacles
 * rise out of the water, the Yeti has climbed its ridge and thrown, the Titan has climbed out of the lava and opened its heart, the Helicopter has dropped in); `midSettleS` lets the last phase surface before `midShot`.
 * `firstPhase`: the id prefix(es) of the first phase. `minProjectiles`: thrown things (the Yeti's snowballs) on screen
 * in <level>-boss.png, each then shot through processHit as a normal kill that leaves the boss's hp alone. `midPhases`: phases
 * between the first and the last, each cleared after `midSettleS`. `rideTo`: the track fraction to ride to first, for a boss
 * that stays where it is (the Medusa in the Starr; the Helicopter over the face-off's avenue, #871: summoned wherever the
 * wall clock had taken the car, it hung over the frame's top edge behind the drones) rather than coming to the rider. `passShots`: track fractions ridden to
 * after `midShot`, each a `<level>-boss-pass-<percent>.png` (the ride past the Medusa, ducked for her last phase). `summonAt`:
 * for a boss that picks its place off the rider's (the Yeti's ridge ahead), the track fraction the ride is frozen at when it
 * is summoned, the camera then going back to `rideTo`: the rider's view from a little before where it arrived, far enough
 * back that its lobbed snowball stays inside the frame (#920). All are fractions of the lap, so they move whenever the
 * track is reshaped: `bossChecks.test.ts` holds `rideTo` and `summonAt` to the boss's first 4 s on the ride (#769 moved
 * the Medusa from 0.69 to 0.59 of the lap and the step rode on to 0.7, past her; #926 moved her finale to 0.68–0.75), `summonAt` past `rideTo` and `passShots` after it.
 */
export const BOSS_CHECKS = [
  { level: 'level1', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'balloon-', lastPhase: ['gondola'], midShot: 'boss-gondola', minOnScreen: 1, settleS: 0, midSettleS: 0 },
  { level: 'level2', minWidthFrac: 0.15, weakPoints: 7, firstPhase: ['claw-', 'tail-'], lastPhase: ['stinger'], midShot: 'boss-stinger', minOnScreen: 4, settleS: 2, midSettleS: 1 },
  { level: 'level3', minWidthFrac: 0.15, weakPoints: 6, firstPhase: 'pad-', lastPhase: ['eye'], midShot: 'boss-head', minOnScreen: 3, settleS: 3, midSettleS: 3 },
  { level: 'level4', minWidthFrac: 0.15, weakPoints: 3, firstPhase: 'fist-', lastPhase: ['chest'], midShot: 'boss-chest', minOnScreen: 2, settleS: 4, midSettleS: 1, minProjectiles: 1, rideTo: 0.5, summonAt: 0.53 },
  { level: 'level5', minWidthFrac: 0.15, weakPoints: 4, firstPhase: ['vent-', 'heart'], lastPhase: ['crown'], midShot: 'boss-crown', minOnScreen: 3, settleS: 3, midSettleS: 0 },
  { level: 'level6', minWidthFrac: 0.15, weakPoints: 9, firstPhase: 'snake-', midPhases: 1, lastPhase: ['crown'], midShot: 'boss-crown', minOnScreen: 2, settleS: 2, midSettleS: 1, rideTo: 0.69, passShots: [0.71, 0.73] },
  { level: 'level7', minWidthFrac: 0.15, weakPoints: 3, firstPhase: ['searchlight', 'tail-rotor'], lastPhase: ['hub'], midShot: 'boss-hub', minOnScreen: 2, settleS: 2, midSettleS: 0, rideTo: 0.82 },
]
