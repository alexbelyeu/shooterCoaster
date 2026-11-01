## 2026-11-01 — Marketing clip: re-render for pushes only, no GIF in git (builder, #203)

**Context:** every `npm run clip` re-render committed to `docs/marketing/media/` adds its files
to git history for good; the GIF alone is ~7 MB, twice the MP4, and is made from the same frames.
**Decision:** re-render only for a launch or marketing push, committing the MP4 and stills.
`scripts/clip.mjs` writes the GIF next to the frames in `e2e-results/clip/<size>/` (gitignored);
the README has an ffmpeg line to make one from the committed MP4. The 2026-10-28 GIF already
committed stays (deleting it would not shrink history).
**Consequences:** ~3.4 MB of history per re-render instead of ~10 MB. Whether `docs/marketing/media/`
gets a size budget line is left to the Director.
