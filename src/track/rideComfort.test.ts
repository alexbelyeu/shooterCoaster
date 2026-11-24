import { describe, expect, it } from 'vitest'
import { shippedLevels } from '@/levels/shippedLevels'
import { RUN_SECONDS } from '@/levels/pacing'
import { COMFORT, comfortProblems, rideComfort } from './rideComfort'

/**
 * Levels over the comfort gate while an open issue fixes them: the test reports them instead of failing. Remove a
 * level here in the PR that brings it under (`docs/RIDE-KIT.md` "Rules for building rides").
 */
const KNOWN_OVER: Record<string, string> = {}

describe('ride comfort: no level turns the rider\'s view faster than the eye can follow', () => {
  const rows = shippedLevels().map((level) => ({ id: level.id, problems: comfortProblems(rideComfort(level.track, RUN_SECONDS)) }))

  it(`no 2 s over ${COMFORT.twoSecondMax}°/s, at most ${COMFORT.fastSeconds} s over ${COMFORT.fastSecond}°/s, no snap over ${COMFORT.snapMax}°/s`, () => {
    for (const r of rows.filter((r) => KNOWN_OVER[r.id] && r.problems.length)) console.warn(`ride comfort ${r.id} (known, ${KNOWN_OVER[r.id]}): ${r.problems.join('; ')}`)
    expect(rows.filter((r) => !KNOWN_OVER[r.id] && r.problems.length)).toEqual([])
  })

  it('a known-over level that now passes leaves the list', () => {
    expect(rows.filter((r) => KNOWN_OVER[r.id] && !r.problems.length).map((r) => r.id)).toEqual([])
  })
})

describe('storyboard beats are inside the run (#925, docs/RIDE-KIT.md "What the rider must see" 6)', () => {
  it('no level lands a beat after its run ends', () => {
    const late = shippedLevels().flatMap((level) =>
      (level.track.rideV2?.beats ?? []).filter((b) => b.second > RUN_SECONDS).map((b) => `${level.id} beat at ${b.second} s`),
    )
    expect(late).toEqual([])
  })
})
