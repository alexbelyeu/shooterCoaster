## 2026-11-24 — Total JS 672 → 682, startup 389 → 391 KB gz, `scene.level2.drawCalls` 135 → 170 (Director, #992, #1001, #974)

**Context:** Three finished PRs were blocked on budgets alone. `main` (6dacdb1) measures 671.8 KB gz total, 387.7 startup.
Level 8's slice (#870, PR #959) adds ~6.6 KB gz, nearly all in its own `world-jungle` chunk plus the shared
`GoldenBlimp` / `FlapBird` chunks, and ~0.75 KB startup (its registry entry, theme, postcard). Remappable controls
(#998, PR #1002) add ~1.8 KB, ~0.8 of it startup (`bindings.ts` and the call sites that read it). Together they put
startup at ~389.2 against 389. Level 2's pacing pass (#937, PR #975) puts a second crow V up the lift hill, in the
ride shard's 10 s frame: 145 draws against 135, set against an empty sky (the level-1 twin was #955).
**Decision:** `jsTotalGzipKB` 682 (~680 with both, still under VISION's 700 ceiling), `startupJsGzipKB` 391 (still
under the 392 #960 promised). `scene.level2.drawCalls` 170 (145 + ~20%, as #962 did for level 1; under the 250 bar).
#990 (level 7's ride) closed unused: #966 landed inside 672.
**Consequences:** Total JS has ~18 KB left before the 700 ceiling, about one more world. Worlds 9 and 10 need the
world-chunk diet (shared shaders, packed ride data, `rideData.ts`) before another total raise; per-bird crow cost is
the next step for level 2's draws, not another raise.
