/**
 * Which smoke steps run, and the CI shards that split them (#353). Pure: no browser, no fs.
 *
 * A full `npm run smoke` runs every step. CI runs the same steps as parallel shards
 * (`node e2e/smoke.mjs --shard <name>`, the `smoke (<name>)` jobs in ci.yml), and running
 * every shard covers exactly what the full run covers (`shards.test.ts` checks it).
 */

/** Steps that don't load a level. */
export const UI_STEPS = ['title', 'landing', 'levelSelect', 'daily', 'settings', 'mobile']
/** Steps on the run's first level: `frenzy` (the FRENZY kill, leaderboard entry and frenzy-end rerun) and `seed` ride with its `ride`. */
export const FIRST_LEVEL_STEPS = ['frenzy', 'seed', 'quality', 'pause', 'countdown', 'speed']
/** Per-level steps; each check-specific one only runs on the levels named in STEP_LEVELS. */
export const LEVEL_STEPS = ['ride', 'wave', 'boss', 'pickup', 'scrim']
export const STEPS = [...UI_STEPS, ...FIRST_LEVEL_STEPS, ...LEVEL_STEPS]

/** The levels a check-specific step runs on; smoke.mjs fails at start if its checks disagree. */
export const STEP_LEVELS = {
  wave: ['level2'],
  boss: ['level1', 'level2', 'level3'],
  pickup: ['level1'],
  scrim: ['level1'],
}

/**
 * The CI shards. A shard with `levels` and no `steps` runs every per-level step on them.
 * Each has a `smokeSeconds` budget in budgets.json; a new level needs a shard and a budget.
 */
export const SHARDS = {
  ui: { steps: ['title', 'landing', 'levelSelect', 'daily', 'settings'] },
  level1: { levels: ['level1'], steps: ['ride', 'frenzy', 'seed', 'boss', 'pickup'] },
  'level1-steps': { levels: ['level1'], steps: ['quality', 'pause', 'countdown', 'speed', 'scrim'] },
  level2: { levels: ['level2'] },
  level3: { levels: ['level3'] },
  level4: { levels: ['level4'] },
  level5: { levels: ['level5'] },
  mobile: { steps: ['mobile'] },
}

/**
 * The run's steps and levels from the smoke's flags. `levels` null = every level.
 * Without `shard` or `steps`: every desktop step, plus `mobile` with `--mobile`;
 * `--skip-desktop` leaves the title and the phone run.
 */
export function planRun({ shard, steps, levels, mobile, skipDesktop } = {}) {
  if (shard !== undefined) {
    const spec = SHARDS[shard]
    if (!spec) throw new Error(`unknown shard "${shard}" (shards: ${Object.keys(SHARDS).join(', ')})`)
    if (steps !== undefined || levels !== undefined) throw new Error('--shard sets the steps and levels; drop --steps / --levels')
    return checked(new Set(spec.steps ?? LEVEL_STEPS), spec.levels ?? null)
  }
  const wantedLevels = levels === undefined ? null : levels.split(',')
  if (steps !== undefined) return checked(new Set(steps.split(',')), wantedLevels)
  if (skipDesktop) return checked(new Set(['title', 'mobile']), wantedLevels)
  return checked(new Set(STEPS.filter((s) => s !== 'mobile' || mobile)), wantedLevels)
}

function checked(steps, levels) {
  const unknown = [...steps].filter((s) => !STEPS.includes(s))
  if (unknown.length) throw new Error(`unknown step(s) ${unknown.join(', ')} (steps: ${STEPS.join(', ')})`)
  // frenzy runs inside the first level's ride, and seed compares against that ride's spawns.
  for (const s of ['frenzy', 'seed']) {
    if (steps.has(s) && !steps.has('ride')) throw new Error(`step "${s}" needs "ride" in the same run`)
  }
  return { steps, levels }
}

/** [step, level] pairs a plan runs, given every level id: what shards.test.ts compares. */
export function stepLevelPairs(plan, allLevels) {
  const wanted = plan.levels ?? allLevels
  const pairs = []
  for (const s of plan.steps) {
    if (UI_STEPS.includes(s)) pairs.push([s, null])
    else if (FIRST_LEVEL_STEPS.includes(s)) { if (wanted.length) pairs.push([s, wanted[0]]) }
    else for (const id of wanted) if (s === 'ride' || STEP_LEVELS[s].includes(id)) pairs.push([s, id])
  }
  return pairs
}
