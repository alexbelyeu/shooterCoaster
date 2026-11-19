## 2026-11-19 — Special ride mechanics are track data on the v2 ride; stops are never warped (Builder, #699)

**Context:** The station launch, drop track, jump gap and backwards turntable each need the ride to do something the
v2 plan (#696) had no word for (stand still for a while, face backwards, fly) while the storyboard's beats still land.

**Decision:** Each mechanic is one entry in `TrackParams.mechanics` (arc shares), built with its track by
`src/track/elements/mechanics.ts`. Pure `mechanics.ts` turns them into ordinary v2 zones plus a new `RideV2Spec.holds`
(a stop: the car halts for its seconds); the solver warps only moving time, so a stop lasts its seconds whatever the
beats ask of the stretches round it. Mechanics need `ride: 'v2'` (`rideModel` throws otherwise). The jump's flight is a
fixed ballistic arc built for one speed, and a booster (brake, then launch at 2 g) delivers that speed at the lip; the
solver's warp keeps it physical (speed × a under gravity × a²). The seat faces back by turning the look about the rails'
up; spawning still lays waves ahead along the track.

**Consequences:** A level that rides backwards must place its waves for a rider facing back (a follow-up); changing a
jump's speed means rebuilding its arc, not just its zone.
