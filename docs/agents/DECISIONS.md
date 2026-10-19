# Decisions

Append-only log. Newest at the bottom. Format:

```
## YYYY-MM-DD — Title (role)
Context · Decision · Consequences
```

## 2026-10-19 — Autonomous studio setup (setup session)

**Context:** Alex wants Claude to improve ShooterCoaster continuously with no human
code review, reporting weekly, within one Claude Max 5x subscription.

**Decision:** Scheduled cloud sessions in five roles (Director on Fable; Builders, QA,
Maintainer on Opus; Reporter on Sonnet), coordinated through GitHub issues/labels and
the docs in `docs/agents/`. Safety comes from CI (build, bundle budget, headless smoke
of every level), independent QA before every merge, revert-first incident handling, a
nightly production smoke test, and a `pause` kill switch in STEERING.md.

**Consequences:** Every merge to `main` deploys to production. Builders never merge
their own work. Weekly usage is calibrated with `builder_parallelism` in STEERING.md.

## 2026-10-19 — Agents approve, GitHub merges (setup session)

**Context:** Claude's auto-mode safety check refuses merges to `main` made by an agent
without human review. Alex chose fully autonomous merging with guardrails.

**Decision:** Agents never call the merge API. QA approves with the `agent:qa-approved`
label; `.github/workflows/automerge.yml` squash-merges approved `agent/*` PRs once
`verify` is green on the head commit, and revokes approval when new commits land.

**Consequences:** The merge gate is repository configuration Alex owns and can disable
from the Actions tab. QA's label is the only approval signal.

## 2026-10-19 — Week 1 leads with art direction and game feel, not new levels (Director)

**Context:** First Director playtest. All five levels run and pass CI, but the
screenshots show the same washed-out sky on every biome (Inferno is daytime blue),
wire-thin tracks on hexagonal stick supports, unreadable enemies (black snowmen on
snow), empty mid-grounds, and shooting with almost no feedback. There is no touch
input. STEERING asks for "AAA in feel, cohesion and polish".

**Decision:** M1 (weeks 1–2) is a polish-and-feel milestone across the existing five
levels before any new level ships: per-biome atmosphere, track as a hero structure,
enemy readability, hit feedback, HUD/results/level-select redesign, touch input, and
test surfaces so QA can see combat in screenshots. New levels start in M2 once the
pipeline produces frames we are proud of.

**Consequences:** Week 1's queue is ~45% visual cohesion, ~30% game feel/UI, ~25%
foundations (touch, test hook, file splits, seeded RNG, vitest). Builders working on
the same biome files must rebase carefully; the `BiomeEnvironment.tsx` split is
scheduled to reduce that conflict surface.

## 2026-10-19 — Procedural sky domes replace drei `Sky` (Director)

**Context:** drei's `Sky` is a physical daytime-sky model; it cannot produce an ash
sky, a night sky or an aurora, and its exposure fights the ACES pass.

**Decision:** Skies are a per-biome gradient/noise `ShaderMaterial` on an inverted
sphere (`SkyDome`), with `fog.color` derived from the dome's horizon colour and sun /
ambient colours configured per biome. drei `Sky` may remain only on the title scene
until it is restyled.

**Consequences:** Every biome owns its atmosphere config; new biomes must define one.
Slight bundle growth (a few KB) within budget.

## 2026-10-19 — No online backend until Alex decides (Director)

**Context:** `api/` stubs for leaderboard/daily/ghost are in-memory. Hard rule 4
forbids new paid services or accounts without a decision.

**Decision:** M2 ships *local* leaderboards and daily runs (seeded RNG + persisted
scores). Online leaderboards wait for Alex to pick a backend (Vercel KV, Supabase free
tier, or none) via STEERING.md.

**Consequences:** `api/` stays a placeholder; nothing in the client depends on it.

## 2026-10-19 — Google Fonts at runtime is an accepted pre-existing network call (Director)

**Context:** `src/app/global.css` imports Lobster + Inter from fonts.googleapis.com
(predates the studio). Rule 4 requires runtime third-party calls to be recorded.

**Decision:** Accepted for now. The game must render correctly if the request fails
(system font fallbacks). Self-hosting the fonts (OFL-licensed, record in ASSETS.md)
is a backlog item if load time or privacy becomes a concern.

## 2026-10-19 — Atmosphere implementation details (Builder, #12)

**Context:** Implementing per-biome sky domes (see "Procedural sky domes replace drei `Sky`").

**Decision:** Config lives in `src/levels/environments/atmosphere.ts` (`ATMOSPHERES`),
consumed by `BiomeEnvironment` (lights, fog) and `SkyDome` (shader uniforms). The dome
is a 32×16 sphere of radius 0.9 × camera far, follows the camera, `renderOrder -1000`
with depth test/write off, so it costs exactly the one draw the drei `Sky` used.
Exposure is applied through `gl.toneMappingExposure`, which the postprocessing ACES
`ToneMapping` effect reads; it is restored on unmount so the title scene is unaffected.
The smoke test's screenshot timeout was raised to 120 s (`--shot-timeout`) because
SwiftShader on the 2-core cloud box takes ~40 s per screenshot frame even on `main`.

**Consequences:** New biomes must add an `ATMOSPHERES` entry. Level configs can no
longer override fog colour (the unused `environment.fog` field was removed).

## 2026-10-19 — Coaster structure scales with sqrt(scalar); towers sit on the drawn terrain (Builder, #13)

**Context:** Rails were fixed-size while track curves scale with `track.scalar`
(20–60), and supports were Y-scaled hexagonal cylinders. Issue #13 asks for lattice
towers and rails that look equally thick on every level, within +10 draw calls and
+60k triangles per level.

**Decision:**
- `src/track/trackDimensions.ts` derives `trackScale = clamp(sqrt(scalar / 20), 1, 2.5)`
  and scales rails, ties, towers **and the rider eye height** (`CoasterCamera`
  `heightOffset` = 6 × trackScale) by it. Scaling the eye with the steel keeps the
  near view identical on all levels; sqrt (not linear) keeps the steel from dwarfing
  fixed-size enemies on big tracks. `TrackParams` gains optional `railRadius` /
  `tieSpacing` (defaults 0.35 / 10, multiplied by trackScale).
- Towers are spaced by arc length at 50 × trackScale, but the spacing is widened until
  all towers fit `TOWER_TRI_BUDGET` (34k triangles). Long, high tracks (Arctic 37k,
  Volcanic 62k units long, up to ~1200 high) therefore get sparse, very large towers
  (~700–800 units apart); Theme Park / Ocean get one every ~200–240 units. Ties are
  capped at 1600 per track for the same reason.
- One `InstancedMesh` per height bucket (8 quantile buckets). A bucket's geometry is
  the top H units of the same infinite tower, so shorter towers are sunk into the
  ground instead of Y-scaled (level-design rule 2).
- Footings follow the terrain **as drawn** (`createTerrainSurface` in
  `utils/terrainNoise.ts`), not raw `heightFn`. The 128-segment terrain mesh is linear
  between vertices 47–94 units apart and differs from `heightFn` by up to ~55 units on
  Arctic ridges; footings placed on `heightFn` visibly float. Pads and legs extend
  below `min(drawn, heightFn)` so they are grounded under either surface.

**Consequences:** +8 draw calls and ~+45–52k triangles per level (camera-independent
count, `sceneStats()` in the e2e hook). Tower density on Arctic/Volcanic is limited by
the triangle budget; denser support there needs LOD or per-chunk culling (follow-up).
