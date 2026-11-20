## 2026-11-19 — The game's own personality: the travelling fair's shooting gallery (Alex, via his Claude session)

**Context:** Alex: the UI's accents (a coloured stripe on a card's top edge, glows, a spaced-out caps label over each
title) read as AI-generated, never use them; the game needs its own personality. The UI had no design doc, so every
screen fell back to the same generic look: 51 glow shadows, 31 letter-spaced labels, 13 gradients, frosted glass,
pill buttons and Inter.

**Decision:** `docs/art/PERSONALITY.md` is the UI's identity: the travelling fair's shooting gallery bolted to a
rollercoaster, from fairground signwriting (block and shadow, gold leaf, lined-out panels), the midway shooting
gallery (star targets, notched prize tickets, chaser bulbs) and the ride's enamel boards and operator buttons. House
palette (oxblood, gilt, vermilion, sky, cream, tar), Ultra and Big Shoulders, notched boards, hard shadows, plates that
press, the showman's voice, and a list of banned tells. `scripts/uiTells.mjs`, run by `npm run lint`, fails when a
banned tell's count in `src/` goes up; its baseline only goes down. Fonts: Big Shoulders is SIL OFL 1.1 like Lobster
and Inter (#88); **Ultra is Apache 2.0**, a permissive licence accepted here for a self-hosted font file (licence
text in `public/fonts/LICENSE-Ultra.txt`). Lobster stays in the logo's wordmark (Alex's pick); Inter goes as screens
move over.

**Consequences:** UI PRs are reviewed against `PERSONALITY.md`. Each remaining screen moves over in its own issue;
the baseline in `scripts/uiTells.baseline.json` drops as they land. Changing the personality's direction is Alex's call.
