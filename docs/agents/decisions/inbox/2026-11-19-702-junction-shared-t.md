## 2026-11-19 — Junctions share the track's t (builder, #702)

**Context:** Shoot-to-switch needs a track with two ways round one stretch, but the whole game (ride physics, the v2 plan,
`rideProfile`, spawn windows, pacing, the camera's arc table, the e2e `rideTo`) reads one closed curve's t.
**Decision:** No general track graph. A junction (`TrackParams.junction`, `src/track/junction.ts`) is a branch over one
span [from, to] of the main curve's t: the ride's speed and timing always follow the main curve, and only the seat rides
the routed curve (`CoasterCamera` `seatCurve`). Both routes reach every t, so every beat, wave window and the boss land on
the same second whichever way the car went; the longer branch is ridden faster, its arc eased so the speed matches at the
fork and merge. One junction per track, on a track that doesn't roll, and the switch closes when the car reaches its sign.
The gym's sits on the east-side run (~25–33 s), where there is room for it today, not the storyboard's cave mouth (that ride
isn't built yet).
**Consequences:** Spawn placement and the arc table stay on the main route (the branch keeps within ~7 m of it, so the
waves still fly in to the rider's view). Hard-branch-only waves, their `maxScore` and the server limits are a follow-up;
until then the hard way changes the ride, not the score, so `levelLimits.ts` is unchanged.
