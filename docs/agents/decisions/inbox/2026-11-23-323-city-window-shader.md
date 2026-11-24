## 2026-11-23 — Neon Metropolis: every tower is one instanced unit box, windows in the shader (Builder, #323)

**Context:** The city needs a few hundred towers with lit windows near the track and a skyline ring, inside the
VISION per-frame bar, and a first v2 ride on a trig curve.
**Decision:** Every tower (and the skyline, and the hero tower's tiers) is an instance of one axis-aligned unit box,
scaled per instance; `cityShaders.ts` draws the windows from the fragment's world position and the instance's
translation (a per-tower seed, base and top), so there is no window geometry and one program. Windows fade to the
facade's average glow once a cell is a few pixels (`fwidth`), so the far towers don't shimmer. The asphalt paints the
same `STREET_GRID` the layout keeps the towers inside. All neon is one merged vertex-coloured `MeshBasicMaterial` mesh
burning past white so the bloom takes it. The ride is `ride: 'v2'` on level1's curve with a station launch at the crest
and `crawl` / `drag` set so gravity alone never stalls it (no beats needed).
**Consequences:** Towers must stay unrotated boxes (the shader reads the face from the object normal); a rotated or
non-box tower needs its own material. Neon flicker, the elevated highway, traffic and the boss are follow-ups.
