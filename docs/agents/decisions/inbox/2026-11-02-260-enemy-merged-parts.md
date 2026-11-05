## 2026-11-02 — Enemies: one mesh per material and moving part (Builder, #260)

**Context:** Formation and ground-scatter waves put 25–40 enemies of one type on screen at once. With one `<mesh>` per part (eyes, smile dots, buttons, shards, tendrils), Arctic drew 393 calls and Inferno ~290, over the VISION bar of 250.
**Decision:** In `SharedEnemyAssets.ts`, parts that share a material and move together are baked into one module-level geometry with `placedParts` (positions, rotations and scales as the meshes had them). Only parts with their own animation stay separate meshes (snowman arms, imp tail, golem arms, wisp core pulse). The ember wisp's six tendrils now flicker as one crown instead of each on its own. `budgets.json` holds level4 / level5 at 250 draw calls.
**Consequences:** New enemy models should follow the same rule; a new per-part animation means splitting that part back out deliberately. Hit flash and the warm-up are unaffected (they walk meshes and module exports).
