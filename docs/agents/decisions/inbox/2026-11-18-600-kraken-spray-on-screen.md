## 2026-11-18 — The Kraken's slam reaches the camera as a screen-edge spray (Builder, #600)

**Context:** The brief asks for "a splash that reaches the camera", but the Kraken's slams land 550–1150 units out, too far for the pooled death particles to fly that far.
**Decision:** Each slam emits `sea:spray` with the side of the view it landed on (0 on the defeat, both edges). `ui/hud/SnowSplat` (the Yeti's snowball edge flash) draws it as sea foam and drops over that edge. The splash in the world stays `KRAKEN_SPLASH_DEATH_STYLE` plus camera trauma as before.
**Consequences:** Any future water hit on the camera reuses `SEA_SPRAY_EVENT`; no new particle system and no extra draw calls.
