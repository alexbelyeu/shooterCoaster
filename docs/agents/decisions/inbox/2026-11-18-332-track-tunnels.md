## 2026-11-18 — Track tunnels: one merged mesh, dark by geometry, carried on the arc table (Builder, #332)

**Context:** #332 asked for tunnels (a lit tube the track dives through) and a loop-the-loop. The trig curves are one
closed parametric formula: a vertical circle can't be spliced in without changing the whole track, so the loop is a
follow-up issue; tunnels shipped.
**Decision:** A tunnel is `TrackParams.tunnels` (`{ from: t, length: arc units }`). `setPieces.ts` `withTunnels` puts
the spans on the level's `ArcTable` (`tunnels`), so everything that gets the table knows them without a new prop:
`trackClearance.ts` counts a tunnel sample as wide as the tube (props stay out), the coaster camera eases a 2° FOV kick
and denser wind streaks in and emits `track:tunnel` ('enter' | 'exit', index), and `buildTrackGeometry` shades the
track 0.3× inside. Every tunnel of a level is one merged, world-space mesh (not an InstancedMesh of arches: a swept
tube has no seams on bends and the portals join the same draw call), with a per-vertex `aEmissive` for its lights.
The darkness is the near-black inner wall; fog and exposure stay the level's.
**Consequences:** A level without `tunnels` gets the same table object and byte-identical track geometry. Keep a
tunnel short (~2 s of ride): nothing outside is shootable from inside, and the nightly `pacing` gate counts it.
