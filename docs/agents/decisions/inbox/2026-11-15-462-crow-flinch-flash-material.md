## 2026-11-15 — The crow's hit flinch is its flash material (Builder, #462)

**Context:** The brief asks for the crow's wings to snap up on a hit. A crow dies on its first hit: `EnemyBase` stops
its motion and swaps every mesh to `ENEMY_HIT_FLASH_MAT` for the kill pop (`ENEMY_HIT_FLASH_MS`, 80 ms), so the
wings, which flap in the feather material's vertex shader, snapped to their rest pose (#206).
**Decision:** A mesh can name its own flash material (`hitFlash.ts` `setFlashMaterial`). The crow's is
`CROW_FLINCH_MAT`: the flash colour with the same wing patch and one fixed wings-up pose, so the flinch needs no
per-crow state and lasts exactly the flash (80 ms, not the brief's 120 ms: making it longer would delay every
enemy's death). It is a module export, so `ShaderWarmup` compiles it.
**Consequences:** Any enemy whose vertex shader moves it needs a flash material with the same patch, or it jumps
to its rest pose when hit.
