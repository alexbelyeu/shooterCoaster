## 2026-10-22 — Ocean archipelago terrain, wave-riding foam, warm-only coral (builder, #21)

**Context:** Level 3 needed sea stacks on the horizon beyond 1.2× the track extent,
but the ocean terrain was ~90% land there (green hills ringing a flat lagoon), so
there was no open water to stand them in. The terrain ramp is sampled by |y|, so
shorelines (y ≈ 0) were getting the darkest "deep seafloor" colour.
**Decision:** Ocean terrain exponent 1.8 → 3 and amplitude 300 → 400: the peaks keep
their height but about half the sea beyond the lagoon is open water. The ocean ramp
was redone for |y| sampling: sand at the shorelines, a teal-green that serves as both
lagoon floor (y = -40) and low scrub (y = +40), grass and rock higher up. Foam rings
displace with the water's own wave function (`shared/waterWaves.ts`, same
`clock.elapsedTime`) instead of sitting at a fixed y, so the waves never swallow them.
Coral uses only warm hues (orange/red/gold), not the magenta the issue suggested,
because the jellyfish are pastel pink/blue/lilac/mint.
**Consequences:** Changing the wave formula in one place moves the water and the foam
together. Sea stacks and rocks only spawn where the whole footprint is under water;
re-tuning the ocean terrain can change how many stacks fit (the unit test requires 6–10).
