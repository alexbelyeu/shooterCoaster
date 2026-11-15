## 2026-11-15 — Ready waits for the level chunk; smoke steps wait for `levelReady()` (Builder, #464)

**Context:** Since #376 the level scene is a lazy chunk prefetched once the title is idle. A run started before it lands
(slow network, cold cache, a quick PLAY) left the countdown's Ready waiting at most 4 s for the warm-up, so GO could open
on the composer alone: a black scene, 17 draw calls. The smoke's `quality` and `pickup` steps measured exactly that on slow
sandboxes (`?e2e=1` starts in `playing` at once), and `hidden-pause` primed a combo the late mount then reset.
**Decision:** Ready holds until the chunk has arrived, however long that takes (a failed load still returns to the title
through SceneManager's boundary); the 4 s warm-up cap counts from the chunk's arrival (pure `ui/hud/countdownGate.ts`).
Every smoke step that starts a level waits for the hook's `levelReady()` before it measures, and `--level-chunk-delay <ms>`
reproduces the slow runner on any machine.
**Consequences:** On a slow connection the player sees Ready for longer instead of GO over nothing. A new smoke step that
starts a level goes through `startLevelReady`, never a bare `startLevel` evaluate.
