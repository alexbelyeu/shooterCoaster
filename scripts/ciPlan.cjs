// Which CI jobs a run needs (#371), decided by ci.yml's `changes` job: a check the diff can't affect only makes noise.
// Pure: the event and the PR's changed files in, the plan out.

const { isDocsOnly } = require('./studioHealthRules.cjs')

/** What the portal build depends on beyond the game itself (CLAUDE.md `build:portal`). */
const PORTAL_INPUT = /^(vite\.config\.ts|index\.html|public\/|scripts\/portal\/|package(-lock)?\.json|\.github\/workflows\/ci\.yml)/

/** What the service worker depends on (#1004): its source and precache list, the build that bundles it, the headers it is served with, its registration, the check and the job. */
const SW_INPUT = /^(src\/sw\/|scripts\/swPrecache\.mjs$|vite\.config\.ts$|vercel\.json$|src\/app\/serviceWorker\.ts$|e2e\/prod-check\.mjs$|\.github\/workflows\/ci\.yml$)/

/** Each level's biome folder (`src/levels/environments/biomes/<biome>/`); `ciPlan.test.ts` holds it to the registry. */
const BIOME_LEVEL = { themePark: 'level1', desert: 'level2', ocean: 'level3', arctic: 'level4', volcanic: 'level5', gym: 'level6', city: 'level7', jungle: 'level8' }
/** Code every level's pacing runs through: the ride, the level configs and their spawns, and the metric itself. */
const SHARED_PACING = /^(src\/track\/|src\/levels\/(LevelRegistry|pacing)\.ts$|src\/entities\/(spawning|bosses)\/|src\/testing\/lineOfSight\.ts$|e2e\/pacingMetric\.mjs$)/
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f)

/**
 * The levels whose time with nothing to shoot a PR can change (#761): a level's own biome folder, or code they all
 * share (then every level). Each gets a `pacing (<level>)` job, the smoke's `pacing` step against `budgets.json`.
 */
function pacingLevels(files) {
  const code = files.filter((f) => !isTest(f))
  if (code.some((f) => SHARED_PACING.test(f))) return Object.values(BIOME_LEVEL)
  const levels = new Set()
  for (const f of code) {
    const biome = /^src\/levels\/environments\/biomes\/([^/]+)\//.exec(f)?.[1]
    if (biome && BIOME_LEVEL[biome]) levels.add(BIOME_LEVEL[biome])
  }
  return [...levels].sort()
}

/**
 * `game`: unit + build, Lighthouse and the smoke shards; `pacing`: the levels to run the pacing step on (off only on a docs-only PR; a docs-only PR touching
 * `scripts/` still runs `unit`). `portal`: on a PR touching its inputs, nightly, or a hand-started run. `offline`: prod-check's
 * `assets`, `routes` and `offline` checks on the local build (the only PR job that registers the service worker), when the same holds for its inputs.
 * Pushes to main and the post-merge runs (`merged` set) run the game jobs, not portal or offline.
 */
function ciPlan({ event, files = [], merged = '' }) {
  if (event !== 'pull_request') {
    // main's pacing is the nightly's (prod-smoke.yml); a PR checks the levels it touches.
    const nightlyOrByHand = event === 'schedule' || (event === 'workflow_dispatch' && !merged)
    return { game: true, unit: true, portal: nightlyOrByHand, offline: nightlyOrByHand, pacing: [] }
  }
  const game = !isDocsOnly(files)
  return {
    game,
    unit: game || files.some((f) => f.startsWith('scripts/')),
    portal: files.some((f) => PORTAL_INPUT.test(f)),
    offline: files.some((f) => SW_INPUT.test(f) && !isTest(f)),
    pacing: game ? pacingLevels(files) : [],
  }
}

module.exports = { ciPlan, BIOME_LEVEL }
