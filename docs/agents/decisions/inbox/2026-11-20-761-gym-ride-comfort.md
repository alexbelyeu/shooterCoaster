## 2026-11-20 — The gym grows to GYM_SCALE 48 and its ride runs at the rider's scale, slower and spread out (builder, #761)

**Context:** Alex found level 6's rebuilt ride dizzying: its view turned at 100–280°/s for seconds and snapped at up
to 900°/s; the comfort gate (`src/track/rideComfort.ts`, #762) failed it. The ride ran at real-coaster speeds in an
80 m hall, and the v2 solver warps time so each beat lands on its second, so scaling the art alone changed nothing.
**Decision:** `GYM_SCALE` 32 → 48 (the hall 3840 units long, everything derived from it; the hall's haze ×1.5). The ride
keeps level 1's gravity and speeds in world units (6.25 m/s² in the hall; 2–7 m/s through the elements, 12 m/s across
the hall, ~14 m/s at the drop's bottom) and is reshaped so its natural, unwarped timing already lands the beats
(solver scales 0.9–1.15): a slow heartline roll over the Flame (~5 s) instead of a zero-g roll, the cave as one loop,
the wall ride on Alaska at x 32 m, a level braking helix into a 2 m/s face-off, a gentler dive, and a slow roll through
the Tree. The Arch's head-chopper moves to the ride home after the run (no time for the detour in 60 s), and the
comfort measure rides a drop track upright, as `seatPose` does.
**Consequences:** Every level passes the comfort gate with no known-over entry. The station moves 10 m north on the
black path; the intro tour's landmark pass moves to the hall's south end. Level 6's spawns still leave the wall ride
and the drop with nothing to shoot (#768).
