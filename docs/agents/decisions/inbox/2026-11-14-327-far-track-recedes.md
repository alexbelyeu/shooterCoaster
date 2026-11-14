## 2026-11-14 — The track's pixel floor thins with distance, and the track fogs early (Builder, #327)

**Context:** The 2026-10-31 pixel floor kept every far rail 3 px wide with no depth cue, so on bright levels
(Theme Park, Ocean, Antarctica) the whole far loop read as bold white cables over the landscape.

**Decision:** The floor is a `PixelFloor` (`near` / `far` px, `trackDimensions.ts`): the near value out to
`PIXEL_FLOOR_FADE_START` (200 units of view depth), smoothstepped to the far one by `PIXEL_FLOOR_FADE_END` (1,200):
rails 1.5 → 0.5 px, lattice 0.5 → 0.3 px. MSAA resolves the sub-pixel lines as fainter strokes. `withTrackHaze`
(`minThickness.ts`) fogs the track and tower steel as if the scene's linear fog ended at `TRACK_FOG_REACH` (25%) of
its span, so far track takes the sky tint before the landscape does. Theme Park's rail is a warm off-white (`0xf3ece0`).

**Consequences:** Raising the far floor back to 1.5 px or dropping the haze brings the cables back. Near rails (under
~200 units) are unchanged; no geometry, draw call or hit test changes. Exponential fog is left as three draws it.
