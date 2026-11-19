## 2026-11-19 — Lanternflies show red at rest, not only in flight (builder, #665)

**Context:** A real spotted lanternfly at rest is a beige wedge: its forewings hide the red hindwings, which show only
when it opens them. On the gym's pale walls, from the ride and on a phone, that wedge read as nothing at all (Alex's
18 Nov playtest).
**Decision:** Readability over accuracy. Folded, the hindwings fan just past the forewings (`Lanternfly.tsx` `FOLDED`),
so each wedge is edged red; every sit has one wing flick (`hopGlideMotion.hot.ts` `sitWings`, `HOP.flash*`) as well as
the open wings of every hop; and the model is drawn at x7 (was x4), with the hop distances, swarm spacing and hit
radius scaled with it.
**Consequences:** Don't fold the hindwings back under the forewings or drop the flick to match the real insect: the swarm
goes back to being invisible. A smaller lanternfly needs `HOP` distances, `SWARM_SPACING` and its `RADII` scaled down with it.
