## 2026-10-30 — Arctic trees get an unlit fill instead of a brighter scene (Builder, #62)

**Context:** Arctic pine canopies rendered as near-black "umbrellas" that players took for
enemies. Their colours (sRGB lightness 20–30%) were dark, but the bigger cause was light: the
low sun backlights the cone sides the rider sees, and ACES plus the arctic grade crush those
low values while the bright snow beside them stays pale. Even pale canopies (lightness ~60%)
rendered at about (27, 40, 76).
**Decision:** `BiomeTreeConfig.fill` adds that fraction of a tree's own lit colour (instance
tint × crown shade) as emissive light in the shared tree shader (`patchTreeFillFragment`,
uniform `uTreeFill`, same program for every tree). Arctic uses 0.35 with lighter blue-green
canopies (lightness 36–46%) and a lighter trunk. Raising the hemi light or exposure was
rejected: it would wash out the snow that makes the Antarctica frame. Volcanic keeps fill 0
(its trees are meant to be charred black).
**Consequences:** A biome whose trees read too dark can set `fill` without touching its
lighting. Draw calls, triangles and shader program count are unchanged.
