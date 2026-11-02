## 2026-11-02 — Week 3: M3 opens early with the finales and Level 6; milestones on GitHub; small issues are bundled (Director)

**Context:** M2's content landed in week 2 (combo tiers, formations, death variety, two
bosses, pickups, daily run, pause, settings, share, launch tooling); only the leaderboard
(finished on a branch, lost to a conflict) and a green smoke on `main` remain. The queue
held 27 `agent:ready` issues, almost all P3 review follow-ups, and no player-facing work.
Alex asked for the roadmap to run as GitHub milestones (#192) and for sound to keep pace
(#212), whose next steps all waited on his theme pick (#301). Builder runs cost ~6M tokens
each regardless of issue size (ledger diag, #298).

**Decision:**
- M2 closes on #317 (re-land the leaderboard branch) and #316 + #305 (Ocean opening, fixed
  level-time sampling in the smoke). M3 ("Depth and spectacle", milestone #2, due 6 Dec)
  opens this week rather than next: the three remaining finales (#318 Scorpion P1, #319
  Yeti, #320 Magma Titan), the Level 6 Neon Metropolis epic (#322) as three vertical slices,
  the Ocean's water (#326), far-rail depth (#327), Inferno's lava (#331), a swoop intro and
  results orbit (#328), tunnels and a loop (#332).
- Audio engine work is decoupled from Alex's picks: intensity layers + FRENZY lift (#321,
  P1, any score) come first; #302 shrinks to swapping in the picked themes.
- The PLAY-straight-to-ride funnel change (#329) is filed but held until the Showcase
  week has been measured against the W44 baseline (Marketer, 9 Nov).
- Milestones: the Director owns them (REST only), sets one on every issue, closes and
  creates them against VISION.md's exit criteria (`.claude/agents/director.md`,
  PROTOCOL.md). #330 makes them visible on the status page and in the weekly report.
- Related small follow-ups are bundled into one issue per session (#333–#339 cover 16
  P3 issues, which lose `agent:ready` and close with the bundle's PR). #241 folded into
  #299; #187 closed as done; #40 superseded by #317.
- `budgets.json` was not lowered to the VISION 250-draw bar on levels 4–5: `knownOver`
  would silence the whole level's gate while #260 is open. #260 lands the ceiling itself.

**Consequences:** 29 `agent:ready` issues for the week (6 P1, 11 P2, 12 P3 of which 7 are
bundles) plus 7 blocked ones with named unblockers, against ~29 expected builder
completions (21 runs × parallelism 2 × ~70 %). If the Showcase week shows the
mobile start rate under half of desktop's on ≥ 20 mobile visitors, the next Director
run puts a phone title → PLAY → ride issue at P1 ahead of the finales.
