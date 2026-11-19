## 2026-11-18 — Warm-up draws: one batch a frame, into a target like the composer's (Builder, #625)

**Context:** After #597 the first frames of play still took 1.5–3.5 s, nearly all "outside" our JS. Measured on
SwiftShader (`?perf=1`, CPU 1× and 4×): the long frame always came straight after the warm-up's draws. A first
draw's cost is mostly the GPU's (pipeline builds), which `gl.render`'s JS time never shows, so the time-budgeted
slices put every draw batch into one frame and the GPU held the next one for seconds. Once the warm-up had fully
finished, the next visible frame took a normal frame's time.

**Decision:** `ShaderWarmup` draws one batch a frame, and keeps doing so after GO instead of finishing in one go
(the compiles still finish in one go at GO, because a visible frame would wait on them anyway). A run that is already
playing when the level mounts (`?e2e=1`) draws them all at once, as before. The draws go into a 64×64 target with
the composer scene target's samples, format and depth attachment (`composerSceneTarget`), because Metal and Vulkan
build a pipeline per program for each of those.

**Consequences:** `sceneReady` can now arrive a few frames after GO on slow devices; nothing during play reads it.
Don't put the draws back on a time budget. The SFX bake (`bake.ts`) is built and cut in 8 ms tasks for the same
reason: it lands in the countdown.
