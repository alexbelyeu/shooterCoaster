// Which CI jobs a run needs (#371), decided by ci.yml's `changes` job: a check the diff can't affect only makes noise.
// Pure: the event and the PR's changed files in, the plan out.

const { isDocsOnly } = require('./studioHealthRules.cjs')

/** What the portal build depends on beyond the game itself (CLAUDE.md `build:portal`). */
const PORTAL_INPUT = /^(vite\.config\.ts|index\.html|public\/|scripts\/portal\/|package(-lock)?\.json|\.github\/workflows\/ci\.yml)/

/**
 * `game`: unit + build, Lighthouse and the smoke shards (off only on a docs-only PR; a docs-only PR touching
 * `scripts/` still runs `unit`). `portal`: on a PR touching its inputs, nightly, or a hand-started run.
 * Pushes to main and the post-merge runs (`merged` set) run the game jobs, not portal.
 */
function ciPlan({ event, files = [], merged = '' }) {
  if (event !== 'pull_request') {
    return { game: true, unit: true, portal: event === 'schedule' || (event === 'workflow_dispatch' && !merged) }
  }
  const game = !isDocsOnly(files)
  return {
    game,
    unit: game || files.some((f) => f.startsWith('scripts/')),
    portal: files.some((f) => PORTAL_INPUT.test(f)),
  }
}

module.exports = { ciPlan }
