## 2026-10-24 — Tree wind sway is a vertex patch on one shared clock (Builder, #124)

**Context:** Trees were static. Idea from Alex's review of mrdoob's MIT-licensed
slop-newyork (`createTreeMaterial`); its source was not read in this session, so the GLSL
was written from the issue's description and carries no third-party notice.
**Decision:** `shared/treeWind.ts` patches the trunk and canopy Phong materials at
`<begin_vertex>`: a world-space push of H·(h/H)² along a fixed wind direction, gusts as a
travelling wave over `instanceMatrix[3].xz` plus a per-tree hashed flutter. h/H comes
from a per-part uniform (`TRUNK_PART` / `CANOPY_PART`, which also build the instance
matrices), so both parts bend as one field and share one program. Every tree material
reads the module-level `treeWindTime`, set once per frame by `TreeField` from the R3F
clock (wall time, so trees keep swaying while paused or in slow-mo, like the kelp).
Canopy geometries now get a baked `color` attribute (darker underside): the canopy
material had `vertexColors` on with no such attribute, so every canopy rendered black.
**Consequences:** Tree instance matrices must stay translate + scale (the shader divides
the sway by the instance's X/Z scale). A new canopy geometry is shaded by `bakeCrownShade`
automatically; don't add `color` attributes in `canopyGeoFactory`.
