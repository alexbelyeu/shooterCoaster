# State of the game

_Snapshot written during setup on 2026-10-19. The Director rewrites this weekly._

## What exists

- **v2 game** (React Three Fiber, TypeScript), deployed to https://shooter-coaster.vercel.app from `main`.
- **5 levels** in `src/levels/LevelRegistry.ts`: level1 Theme Park, level2 Desert,
  level3 Ocean, level4 Antarctica, level5 Inferno (spec: `docs/level5-volcanic-spec.md`).
- Procedural tracks (trig curves), biome environments with landmarks (Ferris wheel,
  carousel, pyramid, rock arches, sunken city, ice fortress, volcano), instanced
  decorations, terrain height functions, wave-based enemy spawner, combo scoring,
  stars, slow-mo, Tone.js music/SFX, post-processing (bloom, vignette, tone mapping).
- `api/` serverless stubs for leaderboard, daily seed and ghost replays — **in-memory
  placeholders**, not persistent.
- Legacy v1 game (2015) still in the repo (`js/`, `index.legacy.html`, …), not built.

## Tooling (added 2026-10-19)

- CI (`.github/workflows/ci.yml`): typecheck + build, bundle budget, headless smoke
  test of title + all 5 levels, screenshots as artifacts.
- Nightly + post-deploy production smoke (`.github/workflows/prod-smoke.yml`) opens an
  `agent:prod-broken` issue on failure.
- `?e2e=1` test hook (`src/testing/e2eHook.tsx`).

## Baseline numbers (2026-10-19)

- JS bundle: ~508 KB gzipped total (three 172, r3f 121, app ~215). Budget 700 / largest chunk 260.
- Smoke: all 5 levels pass in headless SwiftShader.

## Known issues / debt

- No unit tests; only the smoke test.
- App code is a single ~215 KB gz chunk (no per-level code splitting).
- Unmerged branches from Alex: `abelyeu.fix-hud-glitch`, `abelyeu.fix-replay-memory-cleanup`,
  `abelyeu.terrain-overhaul` — **don't merge or delete; ask Alex via the report** if relevant.
- Heap analysis notes in `docs/HEAP-BOTTLENECKS.md`.
