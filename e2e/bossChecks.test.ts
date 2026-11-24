import { describe, expect, it } from 'vitest'
import { shippedLevel } from '@/levels/shippedLevels'
import { RUN_SECONDS } from '@/levels/pacing'
import { createTrackCurve } from '@/track/curves/createTrackCurve'
import { buildArcTable } from '@/track/arcLength'
import { rideModel, rideProfile } from '@/track/ridePhysics'
import { BOSS_CHECKS } from './bossChecks.mjs'

/** Seconds after the boss's arrival the step may ride to: the face-off her level's track keeps her in view for (gymTrack.test.ts). */
const FACE_OFF_SECONDS = 4

/** The lap fraction (arc length, as `rideTo` takes it) the ride reaches at each 0.1 s from GO. */
function lapFractions(levelId: string): number[] {
  const track = shippedLevel(levelId).track
  const table = buildArcTable(createTrackCurve(track))
  return rideProfile(table, rideModel(track, table), RUN_SECONDS + 5).map((s) => s / table.length)
}

/** The ride's time at the first 0.1 s step that reaches `fraction` of the lap. */
const secondsAt = (fractions: number[], fraction: number) => fractions.findIndex((f) => f >= fraction) / 10

describe('the boss step rides to its boss (#769)', () => {
  const riding = BOSS_CHECKS.filter((c) => c.rideTo !== undefined)

  it('has a check that rides', () => {
    expect(riding.map((c) => c.level)).toContain('level6')
  })

  for (const check of riding) {
    const at = shippedLevel(check.level).boss!.at

    it(`${check.level}: rideTo is in the boss's first ${FACE_OFF_SECONDS} s`, () => {
      const t = secondsAt(lapFractions(check.level), check.rideTo!)
      expect(t, `rideTo ${check.rideTo} is ridden at ${t} s; the boss arrives at ${at} s`).toBeGreaterThanOrEqual(at)
      expect(t, `rideTo ${check.rideTo} is ridden at ${t} s; the boss arrives at ${at} s`).toBeLessThanOrEqual(at + FACE_OFF_SECONDS)
    })

    it(`${check.level}: summonAt is past rideTo, in the boss's first ${FACE_OFF_SECONDS} s`, () => {
      if (check.summonAt === undefined) return
      expect(check.summonAt).toBeGreaterThan(check.rideTo!)
      expect(secondsAt(lapFractions(check.level), check.summonAt), `summonAt ${check.summonAt}`).toBeLessThanOrEqual(at + FACE_OFF_SECONDS)
    })

    it(`${check.level}: passShots come after rideTo, in order, before the run ends`, () => {
      const fractions = lapFractions(check.level)
      const shots = check.passShots ?? []
      expect([...shots].sort((a, b) => a - b)).toEqual(shots)
      for (const f of shots) {
        expect(f).toBeGreaterThan(check.rideTo!)
        expect(secondsAt(fractions, f), `passShot ${f}`).toBeLessThanOrEqual(RUN_SECONDS)
      }
    })
  }
})
