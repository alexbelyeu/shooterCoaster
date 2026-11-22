## 2026-11-22 — Aerial fog patches three's fog chunks once, globally (Builder, #836)

**Context:** The fog should take on the sky in the view direction (warmer towards the sun, the zenith's blue away).
Many materials already carry an `onBeforeCompile` patch, so a per-material patch would mean touching every one.
**Decision:** `src/levels/environments/shared/aerialFog.ts` `installAerialFog()` appends to `ShaderChunk.fog_*`
and adds three uniforms to every fogged `ShaderLib` shader and `UniformsLib.fog`. `GameCanvas` calls it at module
load, before any program compiles (three caches a built-in material's program by its parameters, not its source).
The uniform values are plain `{x, y, z[, w]}` objects, which `UniformsUtils.clone` passes by reference, so one write a
frame (`BiomeEnvironment`, damped by `sceneFog.ts` `aerialDamp` while a dark section, the eruption or a weather pulse
closes the fog) reaches every material. Strength 0 (the default, the title, the gym, Night Ride, the dev pages that
never install it) is three's own fog exactly.
**Consequences:** Never swap those values for `Vector3`s (each material would get its own copy and the tint would
freeze at its first value). Custom fog code that wants the tint calls `aerialFogColorGlsl()` (the track's haze, the
ocean); shaders with their own fog maths (smoke, flame, contact shadows, enemies) stay flat.
