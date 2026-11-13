## 2026-11-13 — Measuring hitches before fixing them (Builder, #536)

**Context:** Alex's MacBook Neo stutters and freezes in Safari, even on `?quality=low`. Nothing in the studio measured single long frames: the smoke runs on a fast unthrottled runner and telemetry kept only p50 / p95.
**Decision:** `?perf=1` turns on a hitch recorder for that page load only: no storage, no network, lazy chunks (only the flag check is in the startup JS). The smoke reports programs compiled after each level's warm-up (ride and `pacing`) and, with `--cpu-throttle`, the longest frame and the frames over 100 ms. Neither fails yet: they are the baseline the fix issues work against, and a later PR makes them gates. Telemetry's `maxMs` / `longFrames` are optional on the server, so cached older clients still validate.
**Consequences:** `eventBus.taps` sees every event name. Keep a tap cheap (a Set add): it runs on every emit while `?perf=1` or `?e2e=1` is on.
