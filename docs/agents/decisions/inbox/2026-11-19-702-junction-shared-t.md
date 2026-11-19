## 2026-11-19 — Junctions share the track's t (builder, #702)

**Context:** Shoot-to-switch needs a track with two ways round one stretch, but the whole game (ride physics, the v2 plan,
`rideProfile`, spawn windows, pacing, the camera's arc table, the e2e `rideTo`) reads one closed curve's t.
**Decision:** No general track graph. A junction is a ride mechanic (#699's `TrackParams.mechanics`, `kind: 'junction'`,
`src/track/mechanics.ts`), a branch over one span [from, to] of the lap's arc share (a spline's t): the ride's speed and
timing always follow the main curve, and only the seat rides the hard route (`seatPose` on the run's `route` in
`useGameStore`, 'hard' once the sign is shot). Unlike the other mechanics it sets no zones, so it runs on either ride. Both routes reach every t, so every beat, wave window and the boss land on
the same second whichever way the car went; the longer branch is ridden faster, its arc eased so the speed matches at the
fork and merge. On a spline track that doesn't roll, never over another mechanic from its sign to its merge (`checkMechanics`: the
branch's seat would miss a drop's or turntable's turn), and the switch closes when the car reaches its sign. The switch's
hit sphere is the board's half height and it gets no aim assist, so a shot or tap meant for an enemy never picks the route.
The gym's sits on the east-side run (~25–33 s), where there is room for it today, not the storyboard's cave mouth (that ride
isn't built yet).
**Consequences:** Spawn placement and the arc table stay on the main route (the branch keeps within ~7 m of it, so the
waves still fly in to the rider's view). Hard-branch-only waves, their `maxScore` and the server limits are a follow-up;
until then the hard way changes the ride, not the score, so `levelLimits.ts` is unchanged.
