# ShooterCoaster — instructions for Claude

ShooterCoaster is a WebGL on-rails arcade shooter: you ride a rollercoaster through
themed biomes and shoot enemies against a timer. Owner: Alex Belyeu.

**This repo is developed autonomously by scheduled Claude sessions with no human
code review.** Alex reads a weekly report and steers through
`docs/agents/STEERING.md` and GitHub issues labelled `steering`. Everything an
agent needs to know lives in this repo — sessions have no memory of each other.

If you were started by a scheduled task, read `docs/agents/PROTOCOL.md` and your
role definition in `.claude/agents/` before doing anything else.

## Commands

```bash
npm ci                    # install
npm run dev               # dev server (vite)
npm run build             # typecheck (tsc -b) + production build -> dist/
npm run check:bundle      # bundle-size budget (budgets.json)
npm run smoke             # headless playtest of title + every level (needs a build)
npm run verify            # build + bundle budget + smoke — run before every PR
```

Headless browser in Claude cloud sessions: the Playwright CDN is blocked, so run
`export SC_CHROME="$(scripts/ensure-browser.sh)"` once per session before `npm run smoke`.
The smoke test writes PNG screenshots + `results.json` (frames, draw calls,
triangles, avg frame ms, kills, score, combat stats, errors) to `e2e-results/`:
`title.png`, and per level `<id>.png` (after a 10 s ride), `<id>-combat.png`
(after 4 s of autofire + `killNearest(5)`) and `<id>-results.png`. A level fails if
it gets no kills, autofire never fires at on-screen enemies, or the results screen
never appears. **Look at the screenshots** with the Read tool — that is how you
playtest visually. Waits are polled against the frame counter because software
rendering can run at ~1 fps; tune with `--seconds`, `--combat-seconds`,
`--min-frames`, `--levels level1,level3`.

Test hook: load the game with `?e2e=1` and use `window.__SC_TEST__`
(`levels()`, `startLevel(id)`, `frames`, `drawCalls`, `triangles`, `avgFrameMs`,
`errors`, `phase()`, `stats()` → score/kills/combo/timeRemaining/phase/liveEnemies/
onScreenEnemies/shotsFired, `autoFire(on)`, `killNearest(n)`, `endLevel()`,
`setTimeScale(s)`). See `src/testing/e2eHook.tsx`. Extend it when you need new test
surfaces. Note: bullets move a fixed distance per *frame*, so at ~1 fps headless
autofire rarely lands hits on distant enemies — `killNearest` is what guarantees kills.

## Stack

React 19 + @react-three/fiber 9 + drei + @react-three/postprocessing, three 0.172,
@react-three/rapier (physics), Tone.js (procedural audio), zustand (state),
framer-motion (UI), Vite 6, TypeScript strict. Deployed on Vercel: every push to
`main` goes to production at https://shooter-coaster.vercel.app. Preview deployments
are disabled (`git.deploymentEnabled` in `vercel.json`) — verification happens in CI. Serverless stubs in `api/` (leaderboard, daily seed, ghost
replays — currently in-memory placeholders).

## Code map

| Path | What |
|---|---|
| `src/app/App.tsx` | Phase-driven UI shell (title → levelSelect → playing → paused → results) |
| `src/canvas/` | `GameCanvas` (R3F Canvas), `SceneManager` (picks title vs level scene), shooting, timer, music |
| `src/levels/LevelRegistry.ts` | **Level configs** — track params, biome, timer, waves, star thresholds |
| `src/levels/environments/` | Biome environments, landmarks (FerrisWheel, Pyramid, Volcano…), decorations, terrain |
| `src/track/` | Procedural track curves, track mesh, coaster camera, progress |
| `src/entities/enemies/` | Enemy models/behaviours; `entities/spawning/EnemySpawner` waves |
| `src/combat/` | Aim, collisions, projectiles, weapons, crosshair |
| `src/effects/` | Explosions (pooled), score popups |
| `src/audio/` | Tone.js engine, music + SFX managers |
| `src/store/` | zustand stores: game, player, settings (persisted) |
| `src/ui/` | HUD (`hud/`: score tween, timer bar, combo meter, wave banner) + screens; `theme.ts` per-biome UI accents |
| `src/testing/` | e2e hook |
| `e2e/`, `scripts/` | Smoke test, bundle check, browser helper, heap analyser |
| `docs/` | Specs, perf notes, and the agent operating system in `docs/agents/` |
| `js/`, `index.legacy.html`, `package.legacy.json`, `gulpfile.js`, `assets/` | **Legacy v1 game (2015).** Not built. Don't extend it. |

## Skills in this repo

`.claude/skills/` has project knowledge — use it:
- `shooter-coaster-level-design` — **read before touching levels, enemies, decorations, terrain or landmarks.** It encodes hard-won rules (track extent formula, enemy scaling, z-fighting, terrain-following).
- `threejs-*` — three.js reference for materials, shaders, lighting, postprocessing, etc.
- `workflow-orchestration` — plan → execute → verify discipline.

## Hard rules (all agents, always)

1. `main` must always build, pass `npm run verify`, and be playable. Never merge red.
2. Never force-push, rewrite history, or push directly to `main`. All changes go through PRs. Agents never merge: approval is the `agent:qa-approved` label and GitHub auto-merges (see PROTOCOL.md).
3. Never delete or disable an existing level, mode or feature without a playable replacement in the same PR.
4. No new paid services, accounts, API keys or secrets. No secrets in code. No new third-party network calls at runtime without a DECISIONS.md entry.
5. Only add assets you created (procedural / code-generated) or that are explicitly CC0, and record source + licence in `docs/ASSETS.md`.
6. Budgets in `budgets.json` are enforced by CI. Only the Director may raise them, with a DECISIONS.md entry.
7. Large rewrites (engine, renderer, state, physics) land behind a feature flag or in parallel modules until they reach parity — never a big-bang swap.
8. Dispose three.js geometries/materials/textures and Tone.js nodes you create; no allocations in per-frame hot paths. See `docs/HEAP-BOTTLENECKS.md`.
9. Keep this file accurate. If you change commands, structure or rules, update CLAUDE.md in the same PR.
