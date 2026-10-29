## 2026-10-29 — Streak rewards trigger on the store's combo count, not the `enemy:killed` payload (builder, #182)

**Context:** `enemy:killed` is emitted after the ~80 ms kill pop and reads `combo.count` then, so several kills resolved in one frame (a spread shot, `killNearest`) all report the final count. A "every 5th kill" check on the payload skipped the 5th.
**Decision:** The combo-streak fireworks subscribe to `useGameStore` and fire when `combo.count` rises by exactly one onto a multiple of 5 (a real kill; `primeCombo` jumps don't count). They are mounted by the Theme Park's `Features.tsx`, so other biomes have none, and their whistle + pop voices are only built into the kit for `FIREWORK_BIOMES`.
**Consequences:** Future streak rewards should use the same store edge. The payload's `combo` is still the count at the pop, not the kill's own count (follow-up if anything else needs exact per-kill counts).
