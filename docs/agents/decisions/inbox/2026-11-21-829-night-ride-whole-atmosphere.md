## 2026-11-21 — Night Ride is a whole second atmosphere, keyed by biome (builder, #829)

**Context:** The Night Ride needed a darker sky, lights, fog and grade, lit props and enemies that still read, with
the day look untouched and no new lights or draw calls.
**Decision:** A night preset is a complete `AtmosphereConfig` in `levels/environments/nightPreset.ts`
(`NIGHT_ATMOSPHERES`, keyed by biome), not a set of offsets on the day one. `atmosphereFor(biome, runVariant)` is the
one switch: every reader of the atmosphere (dome, env bake, lights, `combineFog`'s base, the post grade) follows it.
Two optional fields carry the rest: `lampGlow` (props' emissive, through their existing materials) and
`enemyRimLift` (scales every enemy rim uniform scene-wide via `enemyRim.ts` `setRimLift`, reset to 1 when the
environment unmounts). The run option `runVariant` is not persisted, scores and stars stay one board per level, and a
daily is always by day.
**Consequences:** A level gets a Night Ride by adding its biome's preset (`nightPreset.test.ts` covers each entry);
two levels sharing a biome would share it. Anything that reads `ATMOSPHERES[biome]` directly during a run (the
turntable stage, the Kraken's foam fog) stays on the day values; new run-time readers should use `atmosphereFor`.
