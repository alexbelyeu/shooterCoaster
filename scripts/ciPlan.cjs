// Which CI jobs a run needs (#371), decided by ci.yml's `changes` job: a check the diff can't affect only makes noise.
// Pure: the event and the PR's changed files in, the plan out.

const { isDocsOnly } = require('./studioHealthRules.cjs')

/** What the portal build depends on beyond the game itself (CLAUDE.md `build:portal`). */
const PORTAL_INPUT = /^(vite\.config\.ts|index\.html|public\/|scripts\/portal\/|package(-lock)?\.json|\.github\/workflows\/ci\.yml)/

/** Each level's biome folder (`src/levels/environments/biomes/<biome>/`); `ciPlan.test.ts` holds it to the registry. */
const BIOME_LEVEL = { themePark: 'level1', desert: 'level2', ocean: 'level3', arctic: 'level4', volcanic: 'level5', gym: 'level6', city: 'level7' }
/** Code every level's pacing runs through: the ride, the level configs and their spawns, and the metric itself. */
const SHARED_PACING = /^(src\/track\/|src\/levels\/(LevelRegistry|pacing)\.ts$|src\/entities\/spawning\/|e2e\/pacingMetric\.mjs$)/
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
 * `scripts/` still runs `unit`). `portal`: on a PR touching its inputs, nightly, or a hand-started run.
 * Pushes to main and the post-merge runs (`merged` set) run the game jobs, not portal.
 */
function ciPlan({ event, files = [], merged = '' }) {
  if (event !== 'pull_request') {
    // main's pacing is the nightly's (prod-smoke.yml); a PR checks the levels it touches.
    return { game: true, unit: true, portal: event === 'schedule' || (event === 'workflow_dispatch' && !merged), pacing: [] }
  }
  const game = !isDocsOnly(files)
  return {
    game,
    unit: game || files.some((f) => f.startsWith('scripts/')),
    portal: files.some((f) => PORTAL_INPUT.test(f)),
    pacing: game ? pacingLevels(files) : [],
  }
}

module.exports = { ciPlan, BIOME_LEVEL }
