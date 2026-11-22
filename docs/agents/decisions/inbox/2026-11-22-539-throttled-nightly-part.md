## 2026-11-22 — The throttled pass is an extra nightly part, and the nightly gates programs after warm-up (Builder, #539)

**Context:** Slow machines hitch where CI runners don't, and a shader compiled after `ShaderWarmup` is a mid-ride freeze
on a slow driver (#536 / #596). PR shards need a Director-set `smokeSeconds` budget each, and a red nightly part opens a P1.
**Decision:** `e2e/shards.mjs` `NIGHTLY_PARTS.slow` reruns level1 and level3's ride + results under `--cpu-throttle 4`
(the part sets the rate, so prod-smoke.yml's one smoke command stays generic). It is marked `extra`: not counted in the
"parts make the full run once" check, only held to be a subset of it. It shares the other parts' 60 min cap and needs no
`smokeSeconds` entry (two levels; CI rides one level in ~3 min unthrottled). `slow` and `pacing` set `gatePrograms`:
a level with `programs after warm-up` > 0 fails there; PR shards keep reporting the count only. Frame numbers go to
`throttle.json` and fail nothing until a few nightlies give a CI baseline (follow-up issue).
**Consequences:** A new material whose shader the warm-up misses turns the nightly red (P1) within a day, on `pacing`
for any level. Move the gate onto PR shards only with a Director decision on their time.
