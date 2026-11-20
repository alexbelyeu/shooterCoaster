import { describe, expect, it } from 'vitest'
import { PLACEHOLDER } from '../scripts/newWorldPlan.mjs'
import { PLACEHOLDER_RUNS, isPlaceholder, pacingCeilings, placeholderAfterRun, sceneCeilings, setBudget } from './placeholderBudget.mjs'

const scene = (n: number) => ({ drawCalls: 50 * n, objects: 100 * n, triangles: 1000 * n, trackObjects: 10 * n, trackTriangles: 200 * n })

describe('placeholder budgets', () => {
  it('ceilings follow the budgets’ headroom rules', () => {
    expect(sceneCeilings(scene(1))).toEqual({ drawCalls: 60, objects: 115, triangles: 1150, trackObjects: 12, trackTriangles: 230 })
    expect(pacingCeilings({ longestGapSeconds: 2.4, noTargetShare: 0.061 })).toEqual({ longestGapSeconds: 4, noTargetShare: 0.1 })
    expect(pacingCeilings({ longestGapSeconds: 3, noTargetShare: 0.03 })).toEqual({ longestGapSeconds: 4, noTargetShare: 0.05 })
  })

  it('a filled budget replaces the placeholder', () => {
    const text = JSON.stringify({ scene: { level9: PLACEHOLDER } }, null, 2) + '\n'
    expect(isPlaceholder(JSON.parse(text).scene.level9)).toBe(true)
    const filled = JSON.parse(setBudget(text, 'scene', 'level9', { drawCalls: 60 }))
    expect(filled.scene.level9).toEqual({ drawCalls: 60 })
    expect(isPlaceholder(filled.scene.level9)).toBe(false)
  })

  it('takes two clean runs and sets the ceilings from the higher of each number', () => {
    expect(PLACEHOLDER_RUNS).toBe(2)
    const first = placeholderAfterRun('scene', PLACEHOLDER, { ...scene(1), triangles: 3000 }, [])
    expect(isPlaceholder(first.entry)).toBe(true)
    expect(first.entry.runs).toHaveLength(1)
    expect(first.note).toMatch(/run 1 of 2/)
    const second = placeholderAfterRun('scene', first.entry, scene(2), [])
    expect(second.entry).toEqual(sceneCeilings({ ...scene(2), triangles: 3000 }))
    expect(isPlaceholder(second.entry)).toBe(false)

    const gaps = placeholderAfterRun('pacing', PLACEHOLDER, { longestGapSeconds: 3, noTargetShare: 0.04, runSeconds: 90 }, [])
    expect(gaps.entry.runs).toEqual([{ longestGapSeconds: 3, noTargetShare: 0.04 }])
    expect(placeholderAfterRun('pacing', gaps.entry, { longestGapSeconds: 2, noTargetShare: 0.07 }, []).entry)
      .toEqual(pacingCeilings({ longestGapSeconds: 3, noTargetShare: 0.07 }))
  })

  it('records nothing from a run with other problems or a missing number', () => {
    const failed = placeholderAfterRun('scene', PLACEHOLDER, scene(1), ['frame looks blank'])
    expect(failed.entry).toBeNull()
    expect(failed.note).toMatch(/^placeholder not set/)
    // No `stats.scene`: objects and triangles are undefined, never saved as null ceilings.
    const noScene = placeholderAfterRun('scene', PLACEHOLDER, { drawCalls: 40 }, [])
    expect(noScene.entry).toBeNull()
    expect(noScene.note).toMatch(/objects, triangles, trackObjects, trackTriangles/)
    expect(placeholderAfterRun('pacing', PLACEHOLDER, { longestGapSeconds: NaN, noTargetShare: 0.1 }, []).entry).toBeNull()
  })
})
