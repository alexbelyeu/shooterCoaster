## 2026-11-14 — The Medusa's snakes stay shootable between strikes; three phases (builder, #521)

**Context:** #521 suggested snakes "retracting into the hair between strikes (`retract`)", and three phases (four snakes,
four more, the crown snake). The smoke's boss check knew only two phases and clears a phase by hitting every exposed weak
point at once.
**Decision:** A snake recoils between strikes but never leaves the bossModel's exposed set: only later phases are hidden
(coiled into the curls until their phase begins). Three phases, with the smoke's `bossCheck` taught `midPhases` (phases
between the first and the last) and `rideTo` (the Medusa stays in the Starr, so the check rides to 0.75 of the lap first).
**Consequences:** At the smoke's 2 hits a second the fight is ~10 s of hits plus her rise; a retract-between-strikes
mechanic would need the check (and a player) to wait for each snake, and is a separate design change.
