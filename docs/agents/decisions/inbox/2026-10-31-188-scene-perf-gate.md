## 2026-10-31 — Per-level scene ceilings in budgets.json (builder, #188)

**Context:** The VISION bar (≤ 250 draw calls, ≤ 250k triangles per level) was not enforced. On `main` tonight
levels 4 and 5 draw 393 and ~290 calls at the ride screenshot, over that bar, and no open issue covers them, so the
issue's `knownOver` route (ceiling at 250, warn until a fix lands) had nothing to point at. Draw calls also swing
between runs (level 2 measured 91 and 112 on the same commit).

**Decision:** `budgets.json` `scene` sets each level's ceilings from today's measurements: draw calls +20% over the
higher of two runs, scene and track objects / triangles +15% (those are camera-independent and exact). Levels 4 and 5
get plain ceilings above 250 (472, 353) that stop further growth; the smoke fails a level past any ceiling, or one
with no entry. `knownOver: "#<issue>"` on a level's entry turns its failure into a warning, for use once the
Director files an issue to bring a level under the VISION bar (the ceiling can then drop to 250).

**Consequences:** A PR that grows a level's scene past its ceiling fails `verify` with the number in the log.
Raising a ceiling is a budget raise (Director, with a decision entry); a new level adds its own entry. Levels 4 and 5
stay over the VISION draw-call bar until the Director plans that work.
