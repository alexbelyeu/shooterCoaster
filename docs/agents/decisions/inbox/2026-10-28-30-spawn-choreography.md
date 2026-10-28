## 2026-10-28 — Formation waves are placed at activation, relative to the rider (builder, #30)

**Context:** Formations (V, line, school, spiral, ring) only read if they appear where the
player is looking, and the rider's position when a wave activates depends on coaster speed
and frame timing, so it can't be precomputed at level load like scatter spawns.

**Decision:** `entities/spawning/spawnPlacement.ts` (pure) lays a formation wave out in two
steps: at load each member gets a seeded slot in its group's local frame; at activation the
spawner anchors each group on the track ahead of the rider (first point in the rider's
forward cone, else straight ahead) and turns slots into world positions plus an entry start.
`spawnDigest()` hashes the slots, not world positions, so `seed-check` stays deterministic.
An enemy with an `entry` is not a collision target until it reaches its slot (no shots or
touch aim assist on enemies still flying in). #179's ground-enemy placement should build on
the same module (frame + slot → position) rather than in `EnemySpawner.tsx`.

**Consequences:** A formation's world positions differ run to run with the same seed (the
layout doesn't). Formation members get a shared `heading` (crows, scouts, fish) or hold their
slot (ring balloons), so the shape survives after the entry. Waves still activate on the
wall-clock `setTimeout` schedule until #36 moves them to game time; the `wave:incoming` tell
is a second timer 1 s earlier on that same schedule.
