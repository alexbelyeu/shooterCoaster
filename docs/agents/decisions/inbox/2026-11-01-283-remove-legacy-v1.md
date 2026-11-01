## 2026-11-01 — Legacy v1 game and the api/ stubs removed from main (builder, #283)

**Context:** Alex asked for the repo to hold only what the game and studio use. The 2015
game (`js/`, `assets/`, `index.legacy.html`, `package.legacy.json`, `gulpfile.js`,
`.jshintrc`, `base.css`) was ~100 MB of the working tree that nothing built. The `api/`
serverless stubs (leaderboard, daily seed, ghost) were in-memory placeholders that only
the unimported `src/utils/api.ts` called; scores and the Daily Run are local.

**Decision:** Delete both from `main`. The last `main` commit that still has them is
`e78bd27d9a5b6bd2d776358f50b2c1a0d16a0bf8` (`git show e78bd27:index.legacy.html`,
`git checkout e78bd27 -- js assets` to get them back). The playable 2015 game stays on
the `gh-pages` branch (http://alexbelyeu.github.io/shooterCoaster/), which is kept.
`vercel.json` drops the `/api/*` rewrite and its `noindex` header, so `/api/*` is now a
plain 404 (the 404 page is `noindex`). The `/assets/*` immutable cache rule stays: it is
for Vite's hashed bundles in `dist/assets`, not the old folder.

**Consequences:** An online leaderboard or ghost backend (VISION 24, 26) starts from
scratch with Alex's backend decision (hard rule 4), not from these stubs. `.git` does not
shrink (no history rewrite, hard rule 2); fresh clones' working trees do.
