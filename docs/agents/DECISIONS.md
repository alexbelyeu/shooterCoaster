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

## 2026-10-19 — Touch input: Pointer Events only, finger is the aim point (Builder, #16)

**Context:** Input was `mousemove`/`mousedown` on `window`, so phones could not play.
Listening to touch *and* mouse events double-fires (browsers synthesize mouse events
after a tap).

**Decision:** `src/input/pointerInput.ts` is the one input source: window-level
Pointer Events, one active pointer at a time (secondary fingers ignored while one is
held), presses on interactive UI (`button, a, input, label, [role=button],
[data-no-fire]`) never fire. Both `useShooting` and `Crosshair` subscribe to it. On
touch, shots go to the **finger** (a tap fires where you tap); the reticle is drawn
1.25x size, 40 px above the finger with a dashed tether down to a small ring at the
real aim point, so it is never hidden. During play `html.is-playing` sets
`touch-action: none` (plus iOS `gesturestart` blocking) so nothing scrolls or zooms.
A HUD pause button replaces Escape on touch. `.play-button` styles are now global
(they were scoped to the title screen, leaving level-select/pause/results buttons as
unstyled browser defaults under 44 px).

**Consequences:** `npm run smoke` runs the `--mobile` touch playtest too (~90 s
extra), so CI guards touch input and the phone HUD layout. Gyro/gamepad would plug
into the same module later.
