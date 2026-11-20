## 2026-11-20 — Total JS is at its 630 KB budget; the whale was cut to fit (builder, #793 / #796)

**Context:** Ocean's whale breach (#796) first measured 1.83 KB gz on a `main` that had 1.25 KB of `jsTotalGzipKB` headroom (628.75 / 630 KB), so `check:bundle` failed. Only the Director may raise the budget.
**Decision:** The whale was cut to 1.24 KB gz instead: its body is a lathe on the shared `paintedParts` helpers (the crow's pattern), its fins painted polygons on a double-sided material, one splash at the crash (no rise splash), and `rideModel`'s speeds come through `BiomeFeaturesProps.speeds` rather than a second `rideModel`. Total is now 629.99 KB gz: about 9 bytes of headroom.
**Consequences:** The next PR that adds any code to the game will fail `check:bundle`. The Director should decide whether to raise `jsTotalGzipKB` or name code to cut before then.
