## 2026-11-14 — A new world's first budgets come from its first local smoke (builder, #460)

**Context:** `npm run new-world` scaffolds a level, but its `budgets.json` `scene` and `pacing` ceilings
can only be measured once the level renders, and a level without them fails the smoke.
**Decision:** the scaffold writes `{ "placeholder": "…" }` for both. A local smoke run of that level writes
the first ceilings from what it measured, by the budgets' own headroom rules (`sceneCeilings` /
`pacingCeilings` in `scripts/newWorldPlan.mjs`: draw calls +20%, objects and triangles +15%; the longest
gap +1 s, the share +2 points rounded up to 5%). On CI (`CI` set) a placeholder fails with the numbers to
paste, so no level reaches `main` unbudgeted. This sets a new level's first ceilings only; raising an
existing one is still the Director's.
**Consequences:** the builder of a new world commits the budgets its local smoke wrote. `smokeSeconds`
starts at the previous level's value (it only warns, and only on CI).
