/**
 * Placeholder budgets (#460, #552): a level scaffolded by `npm run new-world` starts with `{ "placeholder": "…" }` as its
 * `budgets.json` `scene` and `pacing` entries. Each clean local run of the level (no other problem, every number finite)
 * records what it measured in the placeholder's `runs`; the second sets the ceilings from the higher of the two, by the
 * budgets' own headroom rules, as the existing ceilings were set (budgets.json `_comment`s). Pure, so it is unit tested.
 */

/** Clean runs a placeholder needs before it becomes ceilings. */
export const PLACEHOLDER_RUNS = 2

export function isPlaceholder(budget) {
  return typeof budget?.placeholder === 'string'
}

const roundUp = (n, step) => Math.ceil(n / step) * step

/** `scene` ceilings from a ride's measured totals: draw calls +20%, objects and triangles +15% (budgets.json `scene._comment`). */
export function sceneCeilings(measured) {
  const up = (n, f) => Math.ceil(n * f)
  return {
    drawCalls: up(measured.drawCalls, 1.2),
    objects: up(measured.objects, 1.15),
    triangles: up(measured.triangles, 1.15),
    trackObjects: up(measured.trackObjects, 1.15),
    trackTriangles: up(measured.trackTriangles, 1.15),
  }
}

/** `pacing` ceilings from a run: the longest gap +1 s, the share +2 points rounded up to 5% (budgets.json `pacing._comment`). */
export function pacingCeilings(m) {
  return {
    longestGapSeconds: Math.ceil(m.longestGapSeconds + 1),
    noTargetShare: Math.round(roundUp((m.noTargetShare + 0.02) * 100, 5)) / 100,
  }
}

const MEASURED = {
  scene: { keys: ['drawCalls', 'objects', 'triangles', 'trackObjects', 'trackTriangles'], ceilings: sceneCeilings },
  pacing: { keys: ['longestGapSeconds', 'noTargetShare'], ceilings: pacingCeilings },
}

/**
 * The placeholder `budget` after one run of `section` that measured `measured`, with `problems` the run's other problems.
 * `{ entry, note }`: `entry` is what budgets.json should now hold (null: leave it as it is), `note` says what happened.
 */
export function placeholderAfterRun(section, budget, measured, problems) {
  const { keys, ceilings } = MEASURED[section]
  if (problems.length) return { entry: null, note: `placeholder not set: the run had ${problems.length} other problem(s)` }
  const missing = keys.filter((k) => !Number.isFinite(measured?.[k]))
  if (missing.length) return { entry: null, note: `placeholder not set: no number measured for ${missing.join(', ')}` }
  const runs = [...(budget.runs ?? []), Object.fromEntries(keys.map((k) => [k, measured[k]]))]
  if (runs.length < PLACEHOLDER_RUNS) {
    return { entry: { ...budget, runs }, note: `placeholder: clean run ${runs.length} of ${PLACEHOLDER_RUNS} recorded, run it again to set the ceilings` }
  }
  const highest = Object.fromEntries(keys.map((k) => [k, Math.max(...runs.map((r) => r[k]))]))
  return { entry: ceilings(highest), note: `set from the higher of ${runs.length} clean runs` }
}

export function setBudget(budgetsText, section, id, values) {
  const budgets = JSON.parse(budgetsText)
  budgets[section][id] = values
  return JSON.stringify(budgets, null, 2) + '\n'
}
