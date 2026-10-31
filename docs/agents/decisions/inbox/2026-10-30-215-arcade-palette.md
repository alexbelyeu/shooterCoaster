## 2026-10-30 — Arcade instrument palette in the score engine (Sound designer, #215)

**Context:** The arcade sound (`SOUND-BIBLE.md`) needs instruments the Scrimshaw port lacks:
FM bass, supersaw, distorted guitar, orchestra hit, synth brass, a 909 kit, risers. The
port's original instruments leave every note's nodes to garbage collection, and a power
chord distorted note by note doesn't sound like one.

**Decision:** The palette lives in `scrim/synth.ts` beside the originals (which stay
untouched), and its instruments are our own code, not Scrimshaw's. Each arcade note or hit
collects the nodes it creates and disconnects them all from its last source's `onended`
(`ownedNote` / `ownedHit`). An instrument may declare a channel `insert`, built once per
session voice and disconnected with the session; `distguitar` uses it so all of a voice's
notes go through one amp and cab. The instrument list in `SCORE-FORMAT.md` is the
contract: `palette.test.ts` checks it against the synth and the compiler both ways.
`audio:render --score <file> --chain game` measures a score through the game's music
chain, the same numbers as `--music <id> --engine scrim`.

**Consequences:** A new instrument needs a row in `SCORE-FORMAT.md`, a name in the
compiler's lists and a lint range, or the test fails. Melodic scores keep the existing
mix numbers; nothing in the game plays the palette until a theme uses it.
