## 2026-10-20 — Camera feedback is rotation-only; recoil lives on a weapon view-model (builder, #65)

**Context:** The #60 kill shake translated the camera up to 3 units at ~8–11 Hz, so the
rails directly under it visibly jumped, and the muzzle flash floated at bottom-centre
with no gun. Alex flagged both in playtest.

**Decision:**
- The coaster camera is **never translated** for feedback. Kills add "trauma" (0..1,
  combo-scaled, linear decay to 0 in 240 ms) that drives smooth value-noise pitch/yaw
  (≤ 0.6°) and roll (≤ 1°) on top of the track pose (`src/combat/screenShake.ts`).
  Setting **Screen shake: Off / Reduced / Full** (persisted, default Reduced = half);
  `prefers-reduced-motion` forces Off. The e2e hook reports translation off the track
  pose and smoke fails if it is ever non-zero.
- Fire recoil moves a code-generated **first-person weapon** (`WeaponViewModel.tsx`),
  not the camera. It is one merged mesh (1 draw call, ~200 tris) parented to the camera,
  anchored bottom-right from the viewport's short side (`weaponLayout.ts`), turned most
  of the way toward the aim point. Its vertex shader squeezes its depth into the front
  2% of the depth range, so it never clips into the world but still self-occludes.
- The muzzle flash sits at the barrel tip, and each shot draws a short tracer from the
  barrel to the aim point. Bullets still fly from the camera along the aim ray (hit
  logic unchanged). Shots publish their aim NDC through `lastShot` in `hitFeedback.ts`
  rather than an event payload, so nothing is allocated.

**Consequences:** Don't reintroduce camera position offsets for feedback (the smoke
fails). The volcanic eruption still nudges the camera position by ≤ 0.06 units; it is
a world event, not hit feedback, and is a candidate to move onto trauma later. New
HUD elements in the bottom-right must leave room for the gun (smoke checks
`.hud-panel`, `.hud-combo`, `.hud-pause-button` and `.mute-button`).
