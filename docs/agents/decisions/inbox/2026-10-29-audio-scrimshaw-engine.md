## 2026-10-29 — Audio moves to a port of Scrimshaw Jukebox; Sound designer role (Alex, interactive session)

**Context:** Sound is the game's weakest area: about a dozen basic Tone.js synths
playing hard-coded note arrays, and no role owns audio. Alex pointed at Scrimshaw
Jukebox (Simon Willison, built with Claude Opus 5.5): a plain-text score format that an
LLM writes reliably, played by a 65-instrument Web Audio synth with no samples. Its
source is Apache-2.0 (simonw/tools).

**Decision:** Port Scrimshaw's parser, synth and look-ahead scheduler to TypeScript in
`src/audio/scrim/`. It runs in parallel with Tone.js behind a flag until it reaches
parity (hard rule 7), then Tone.js is removed. All new music is written as scores (the
source of truth), not as code. The original is vendored, unmodified, in
`docs/audio/reference/` with its licence. Ported files keep a credit header naming the
source and saying they were changed. This is third-party *code* under Apache-2.0, not an
asset, so it doesn't fall under the CC0-only assets rule. Every sound is still our own
synthesis, and scores are original compositions. `type:audio` issues go to a new Sound
designer role. Direction is late-90s Sega arcade rail-shooter (`docs/audio/SOUND-BIBLE.md`).
Agents can't hear, so sound is checked by offline renders plus measurements. Alex
listens weekly and picks the first theme for each level in a `Listen:` issue.

**Consequences:** Tone.js work that only polishes the old engine is superseded (#109,
#168, and the Tone lazy-load half of #187). Audio PRs commit small MP3 renders to
`docs/audio/renders/` (overwritten in place). The Maintainer unblocks `Waiting on #<n>`
issues once what they wait on is closed.
