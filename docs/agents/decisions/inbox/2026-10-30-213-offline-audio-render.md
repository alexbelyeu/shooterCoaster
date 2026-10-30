## 2026-10-30 — Audio is checked by rendering the game's own code offline (Sound designer, #213)

**Context:** No agent can hear. The toolkit has to render what the game really plays, deterministically and
faster than real time, without depending on software GL's ~1 fps.
**Decision:** `src/audio/offlineRender.ts` swaps Tone's global context for an offline one for the length of a
render and builds a fresh master chain in it (`AudioEngine.swapInOfflineChain`; the channels are live
bindings), so the unchanged music and SFX managers play into it. The offline context keeps Tone's live 0.1 s
look-ahead, so loop callbacks schedule notes exactly as in the game, and `Math.random` is seeded for the
render. SFX throttles now run on the audio clock (`Tone.now()`), not `performance.now()`, since an offline
render runs its whole timeline in one JS turn. A render only runs on the title screen before audio unlocks.
Loop seams are judged against the closest bar line inside the loop, not as a raw level jump: music swells on
every downbeat. Mix targets are mirrored in `scripts/audio/metrics.mjs`.
**Consequences:** Capturing real-time output is not needed. Anything that adds a module-level Tone node outside
`createMasterChain` would not follow the swap. The future score engine plugs in as one more render kind
(`RENDERS` in `src/testing/audioRender.ts`).
