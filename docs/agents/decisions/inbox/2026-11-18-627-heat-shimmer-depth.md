## 2026-11-18 — Heat shimmer: a depth-tested composer term, in only on the gym (Builder, #627)

**Context:** The Flame's heat shimmer could be a term in the composer's EffectPass or refracting sheets reading a
copy of the frame. A plain screen-rect `mainUv` also wavered the gun and the track in front of the fire.
**Decision:** `HeatShimmerEffect` is a `mainUv` in the one EffectPass with `EffectAttribute.DEPTH`: only pixels
past the hot air's nearest point (and past the gun's depth range) waver. Because depth gives the composer a depth
texture, the effect goes in only on a level whose atmosphere sets `heatShimmer` (the gym), on medium / high and
never on touch; it joins as the level mounts, so its program compiles before `ShaderWarmup` ends.
**Consequences:** Don't make it always-on to save the recompile: every level and phone would then pay for the
depth texture. Another fire that wants it sets `heatShimmer` in its atmosphere and aims `HEAT_SHIMMER` itself.
