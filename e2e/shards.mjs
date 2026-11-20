/**
 * The smoke's named steps and the CI shards that split them (#353): the shards are the PR depth, rendering and
 * integration; the rest (`nightlyOnly()`) runs in the nightly production run of the full smoke (#372).
 */

export const UI_STEPS = ['title', 'landing', 'levelSelect', 'daily', 'settings', 'mobile', 'mobileMenus']
/** On the run's first level; `frenzy` happens inside its ride and `seed` compares against that ride's spawns. */
export const FIRST_LEVEL_STEPS = ['frenzy', 'seed', 'quality', 'pause', 'countdown', 'speed']
/** `tour`, `shot`, `results` and `share` check the ride's own page (`tour` before the ride, the others after its combat). */
export const LEVEL_STEPS = ['ride', 'tour', 'shot', 'results', 'share', 'wave', 'weather', 'boss', 'pickup', 'switch', 'dark', 'audio', 'pacing']
export const STEPS = [...UI_STEPS, ...FIRST_LEVEL_STEPS, ...LEVEL_STEPS]

/** Mirrors the smoke's check constants (WAVE_CHECK, BOSS_CHECKS…), which fail the run at start if they drift. */
export const STEP_LEVELS = {
  wave: ['level2'],
  weather: ['level2', 'level4'],
  boss: ['level1', 'level2', 'level3', 'level4', 'level5', 'level6'],
  pickup: ['level1'],
  switch: ['level6'],
  dark: ['level6'],
  audio: ['level1'],
}

/** Steps that run on another step's page: what they need in the same run. */
const NEEDS = {
  tour: ['ride'],
  shot: ['ride'],
  results: ['ride'],
  share: ['ride', 'results'],
  frenzy: ['ride', 'results'],
  seed: ['ride'],
  mobileMenus: ['mobile'],
  // The dark section's shots and the Tree's gap still (#766): taken on the `switch` step's run.
  dark: ['switch'],
}

const PHONE_STEPS = ['mobile', 'mobileMenus']

/**
 * The nightly production run of the full smoke, split into parallel jobs (prod-smoke.yml's `nightly-part` matrix, #570):
 * one run outgrew the job's 60 min cap once level 6 joined every deep step. Together they make every step of the full run once.
 */
export const NIGHTLY_PARTS = {
  main: { steps: [...UI_STEPS, ...FIRST_LEVEL_STEPS, 'ride', 'tour', 'shot', 'results', 'share'] },
  deep: { steps: ['wave', 'weather', 'boss', 'pickup', 'switch', 'dark', 'audio'] },
  pacing: { steps: ['pacing'] },
}

/** One `smoke (<name>)` CI job each (ci.yml matrix, budgets.json `smokeSeconds`); `shot` and `results` don't depend on the level. */
export const SHARDS = {
  ui: { steps: ['title', 'landing'] },
  menus: { steps: ['levelSelect', 'settings'] },
  level1: { levels: ['level1'], steps: ['ride', 'shot', 'results'] },
  'level1-steps': { levels: ['level1'], steps: ['quality', 'speed'] },
  level2: { levels: ['level2'], steps: ['ride'] },
  level3: { levels: ['level3'], steps: ['ride'] },
  level4: { levels: ['level4'], steps: ['ride'] },
  level5: { levels: ['level5'], steps: ['ride'] },
  level6: { levels: ['level6'], steps: ['ride', 'switch'] },
  mobile: { steps: ['mobile'] },
}

/** Steps + levels (null = all) from the smoke's flags; the default is every desktop step, plus the phone run with --mobile. */
export function planRun({ shard, nightlyPart, steps, levels, mobile, skipDesktop } = {}) {
  if (nightlyPart !== undefined) {
    const spec = NIGHTLY_PARTS[nightlyPart]
    if (!spec) throw new Error(`unknown nightly part "${nightlyPart}" (parts: ${Object.keys(NIGHTLY_PARTS).join(', ')})`)
    if (shard !== undefined || steps !== undefined || levels !== undefined) throw new Error('--nightly-part sets the steps; drop --shard / --steps / --levels')
    return checked(new Set(spec.steps), null)
  }
  if (shard !== undefined) {
    const spec = SHARDS[shard]
    if (!spec) throw new Error(`unknown shard "${shard}" (shards: ${Object.keys(SHARDS).join(', ')})`)
    if (steps !== undefined || levels !== undefined) throw new Error('--shard sets the steps and levels; drop --steps / --levels')
    return checked(new Set(spec.steps), spec.levels ?? null)
  }
  const wantedLevels = levels === undefined ? null : levels.split(',')
  if (steps !== undefined) return checked(new Set(steps.split(',')), wantedLevels)
  if (skipDesktop) return checked(new Set(['title', ...PHONE_STEPS]), wantedLevels)
  return checked(new Set(STEPS.filter((s) => !PHONE_STEPS.includes(s) || mobile)), wantedLevels)
}

function checked(steps, levels) {
  const unknown = [...steps].filter((s) => !STEPS.includes(s))
  if (unknown.length) throw new Error(`unknown step(s) ${unknown.join(', ')} (steps: ${STEPS.join(', ')})`)
  for (const [s, needs] of Object.entries(NEEDS)) {
    const missing = needs.filter((n) => !steps.has(n))
    if (steps.has(s) && missing.length) throw new Error(`step "${s}" needs "${missing.join('", "')}" in the same run`)
  }
  return { steps, levels }
}

/** [step, level] pairs a plan runs (level null for UI steps). */
export function stepLevelPairs(plan, allLevels) {
  const wanted = plan.levels ?? allLevels
  const pairs = []
  for (const s of plan.steps) {
    if (UI_STEPS.includes(s)) pairs.push([s, null])
    else if (FIRST_LEVEL_STEPS.includes(s)) { if (wanted.length) pairs.push([s, wanted[0]]) }
    else for (const id of wanted) if (!STEP_LEVELS[s] || STEP_LEVELS[s].includes(id)) pairs.push([s, id])
  }
  return pairs
}

/** [step, level] pairs only the full run (`--mobile`: the nightly) makes: no PR shard has them. */
export function nightlyOnly(allLevels) {
  const key = ([s, l]) => `${s}@${l ?? '-'}`
  const sharded = new Set(Object.keys(SHARDS).flatMap((name) => stepLevelPairs(planRun({ shard: name }), allLevels)).map(key))
  return stepLevelPairs(planRun({ mobile: true }), allLevels).filter((p) => !sharded.has(key(p)))
}
