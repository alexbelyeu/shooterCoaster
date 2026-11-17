## 2026-11-17 — The countdown hides the level until its warm-up is done (builder, #597)

**Context:** The MacBook Neo froze for ~1 s in the countdown (#561): the level was drawn behind Ready while
`ShaderWarmup` compiled, so a visible frame waited on every program still linking; the sky's PMREM bake, the
compile and the new scene's React render all landed in the mount's one task; and the title froze while the level
chunk evaluated just after the poster left. #464 made Ready wait for the chunk and the warm-up; #376 is the poster.
**Decision:** Until the warm-up ends, the countdown draws nothing of the level (the camera's layer mask is 0, so
Ready sits on black and the level appears at the end of the warm-up, at the latest on GO). The warm-up's compiles
and draws take a slice of each frame (20 ms, or half the rest of a slow frame) and run in one go once the run is
playing (the countdown's cap ran out, `?e2e=1`). The env bake moves to the frame after the mount; scene swaps render
in a React transition; the poster waits for the level chunk (2.5 s at most).
**Consequences:** Don't show the level behind Ready again without making those frames independent of the compile.
`ShaderWarmup` must start after the env bake, or every Standard material compiles twice. The countdown's 4 s cap
still bounds the wait: a device too slow to warm up in it finishes the warm-up in one long frame after GO, as before.
