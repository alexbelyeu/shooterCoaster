## 2026-11-02 — Sea enemies float beside the track, in a band sized to the ride (Builder, #316)

**Context:** Ocean's jellyfish and sharks were scattered over a 1,100-unit disc around the origin, so the
first 10–15 s of the level showed an empty sea (#250). The ground trackside band (700–2200 arc units
ahead, #179) does not fit the Ocean: its ride averages ~250 units/s, so a wave placed 700–2200 ahead is
behind the rider within ~9 s, and its tight turns put much of that band behind the rider in plan.

**Decision:** `jellyfish` and `shark` use `'trackside'` placement on the water. `TRACKSIDE` has a band per
surface: ground stays 700–2200 ahead, water is 300–3600 ahead (60–400 to the side for both), about the
ride between Ocean's waves, so a wave stays in view until the next one lands. A slot over land moves
across the track, then nearer or further within the band, to the first point over the sea. Sharks
circle a 25–60-unit orbit through their spawn point instead of drifting (their old drift had radii up
to ~2,000 units). Ocean gets a second jellyfish wave (12, at 28 s) so the stretch before the flying
fish and the Kraken isn't empty; `maxScore` 2045 → 2261.

**Consequences:** A trackside band is about how far the rider travels while the wave is live, not just
view distance: re-check it when a level's speed or wave gaps change. Water slots are always over the
sea when there is sea within the band. The trackside unit test now checks each enemy is in front of
the rider on the approach (600 arc units before it), not at placement time.
