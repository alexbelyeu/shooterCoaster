## 2026-10-19 — Hit feedback: kill pop delays the explosion by 80 ms (Builder, #14 / PR #60)

**Context:** Every enemy dies in one hit, so "hit flash" and "kill" are the same
moment. Flashing an enemy that unmounts in the same frame is invisible.

**Decision:** A hit scores immediately (score, combo and collision removal are
unchanged), then the enemy freezes at 1.2× scale with every mesh swapped to one
shared white `ENEMY_HIT_FLASH_MAT` for 80 game-ms (and at least one rendered
frame). Only then does it emit `enemy:killed`, explode and unmount. The material
swap stores the original on `mesh.userData` and restores it — no per-enemy
material clones. `enemy:hit` is emitted from the collision path with one reused
payload object (listeners must not retain it). Camera kick/shake is an additive
offset applied after the track pose, so it can never drift the ride. Test-only
`holdFeedback` freezes the muzzle flash and hitmarker for screenshots.

**Consequences:** The explosion, `enemy:killed` (score popups, hitmarker gold)
and the final-kill slow-mo arrive 80 ms after the hit — a deliberate hit-stop.
Future multi-HP enemies can reuse the flash helpers in `EnemyBase` for non-lethal
hits.
