## 2026-10-31 — The ride wind belongs to each SFX engine; kill sounds come off the bus; music loops are `guarded` (sound designer, #109)

**Context:** The wind whoosh built its own Tone nodes on `CoasterCamera` mount, outside the level kit: `sfxNodeCount()` missed
them, it never started when Tone's chunk landed after the level mounted, it ramped (two Tone automation events) every frame,
and under `?audio=scrim` it was the only Tone SFX left. Kill sounds were played by `EnemyBase` / `BossBase` while every other
gameplay sound came from `LevelAudio` (was `MusicController`) bus listeners. The nine music loop callbacks each hand-copied a
`try/catch` into `soundGuard`.
**Decision:** `SfxEngine.wind(speed)`. The Tone kit builds the wind chain through `own()` (it runs silent for the kit's
life) and the arcade engine builds the same chain (looped seeded white noise → band-pass → gain) in its graph, so each
engine's `nodeCount()` covers it and the scrim path no longer needs a Tone SFX node. Both re-aim the wind only when pure
`windUpdateDue` says so (speed moved ≥ 0.02, at most every 0.1 s, and always to 0). `enemy:killed` carries the kill timbre
(`sound`) or the boss weak point (`bossPart`), and `LevelAudio` plays it. Music `Sequence` / `Loop` callbacks are wrapped
once in `guarded(where, cb)`. `SFXManager.test.ts` fails any bare `new` in `SFXManager.ts`, the limit of the smoke's
node-count check. `audioBurst` spaces its kill steps 35 ms apart on the audio clock across every combo tier and reports
`killsPlayed`; the smoke requires all 10.
**Consequences:** A new Tone kit node must go through `own()`. A new kill source emits `enemy:killed` with its sound
instead of calling `sfx().kill` (the Kraken's slam splash is a world effect, not a kill, and still calls it directly).
