## 2026-11-23 — One format for generated ride data (builder, #890)

**Context:** Two generators wrote ride data in two formats, each file carrying its own decoder: level 6's absolute flat lists to
0.01 units, the kit rides' whole-unit steps. Every new ride-kit level would have added a copy.
**Decision:** `src/levels/rideData.ts` is the one pure pack / unpack / rounding module; `scripts/gen-ride-levels.mjs [levelId…]`
is the one generator, a `RIDES` row per level with its precision (`{ position, up }` decimals). Positions are stored as whole-number
steps in units of 10^-position, so level 6 moved to steps too (0.01 units, as before): ~1.4 KB gz less startup JS. Rounding is
`Math.round(v * 10^d) / 10^d` (not `toFixed`), which moved a few of level 6's points by 0.01 at a half.
**Consequences:** A new generated ride is a `RIDES` row and a `rideLevels.test.ts` row. The precision rules of the #863 entry stand.
