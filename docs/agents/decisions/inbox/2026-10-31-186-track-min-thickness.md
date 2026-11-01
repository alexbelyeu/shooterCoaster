## 2026-10-31 — Rails and lattice have a pixel floor, done in the vertex shader (builder, #186)

**Context:** Past a few hundred units the rails and tower lattice thinned to sub-pixel hairlines that broke into
dashes and shimmered. LOD meshes or thicker steel would change the near view, triangles or draw calls.

**Decision:** `withMinThickness` (`src/track/minThickness.ts`) patches the track and tower steel materials: each
vertex moves outward along its cross-section direction (`aThick` attribute: unit direction + real radius) until the
part projects to at least `RAIL_MIN_PIXEL_RADIUS` (1.5 px) or `LATTICE_MIN_PIXEL_RADIUS` (0.5 px) in drawing-buffer
pixels. The FOV is read from `projectionMatrix[1][1]` in the shader, so portrait, rotation and the speed FOV kick need
no uniform update; only the drawing-buffer height (`trackViewportHeight`) is set, on resize / dpr change. Ties and
footings carry a zero `aThick` and keep their size. Up close the real radius is larger and nothing moves.

**Consequences:** Far track reads as a solid line (its rails merge into one ribbon; the tie colour fades out of it).
Any new track or tower geometry drawn with these materials must set `aThick` (zeros if it should not grow), and tower
instances must stay unscaled (the push is in instance-local units). Hit tests and the camera use the curve, not the
mesh, so gameplay is unchanged. The Low preset has no MSAA, so some crawl remains there; FXAA/TAA would be a separate issue.
