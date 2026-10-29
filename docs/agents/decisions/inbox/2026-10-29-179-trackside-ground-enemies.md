## 2026-10-29 — Ground enemies stand beside the track ahead of the rider; smoke gates readability (Builder, #179)

**Context:** Antarctica's snowmen (and Inferno's imps and golems) were scattered over a
disc of radius ~2,400 around the origin while the track runs high over the ridges.
`pickReadableSpawn` only guarantees an enemy is near *some* track point once per lap, so
the ride screenshot showed 0 readable snowmen and a scout was 9 px at 1,000 units.

**Decision:**
- Scatter waves of `snowman` / `snowmanScout` / `snowmanBrute` / `lavaGolem` / `fireImp`
  (`placedBesideTrack` in `spawnPlacement.ts`) get seeded trackside slots at load (arc
  distance 700–2200 ahead, 60–400 to either side) and are placed on `groundFn` from the
  rider's track index when the wave activates. `spawnDigest` hashes the slots, as for
  formations. Other scatter types keep `pickSpawn` + `pickReadableSpawn`.
- Snowman model scale 1 → 1.3, scout 0.6 → 0.9 (silhouettes 65 and 48 units; `RADII`
  scaled to match).
- `npm run smoke` fails a level whose ride screenshot has fewer than 2 enemies ≥ 12 px
  on screen.

**Consequences:** A new ground enemy that should be in the player's face goes in
`placedBesideTrack`, not a bigger `pickSpawn` radius. Removing a type from that list
brings back the "nothing to shoot" ride. The readability gate means a level design that
leaves the opening seconds empty now fails CI.
