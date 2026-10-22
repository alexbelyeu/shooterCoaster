## 2026-10-20 — Arctic aurora and track-biased, ground-settled props (builder, #19)

**Context:** Level 4 needed an aurora and a mid-ground of crystals/drifts. Uniform
`scatterPositions` rings leave the area the rider actually sees sparse, and props
placed on `heightFn` float or sink on Arctic's ridged terrain (the drawn mesh is
linear between vertices, up to ~55 units off).
**Decision:** Biome `Decorations` now also receive `groundFn` (createTerrainSurface)
and the track's `ArcTable` (`track`, shared with #20; there is no second track prop).
New props that frame the ride use `shared/trackScatter.ts`: `scatterNearTrack`
(offsets from arc-table samples, seeded, kept clear with `trackClearance.buildTrackIndex`) and `settleOnGround` (base at
the lowest drawn-ground point under the footprint, rejecting spots that bury more than
a set fraction). The aurora is a camera-following ribbon ring (like `SkyDome`) with
additive blending; the Arctic sky zenith was darkened (0x5a84c2 → 0x34508e) because an
additive effect barely reads on a pale sky. Its intensity is driven by the
`aurora:intensity` event (number, 1 = default).
**Consequences:** Lighten the Arctic zenith again only together with a non-additive
aurora. Other biomes can adopt `trackScatter` for grounded props instead of
`scatterPositions` + `heightFn`.
