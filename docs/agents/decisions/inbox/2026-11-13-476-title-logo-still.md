## 2026-11-13 — The title logo holds still; logo concepts behind `?logo=` (Builder, #476)

**Context:** Alex: "the 'ShooterCoaster' title is like pulsating in a weird way." The wordmark scaled and grew its
blurred glow on every beat of the title music (`--logo-beat`, set per frame), on top of an idle float, a light sweep
and the build-in, so the big Lobster text re-rasterised at a new size every frame. He also asked for a new logo that
says ride + shoot.
**Decision:** No title logo motion tied to the music, no animated scale or blur radius: one build-in, then still, with
at most one gentle idle touch (the wordmark keeps the light sweep; the float and `titleBeat.ts` are gone). Logo
concepts go live as `?logo=<name>` (`ui/screens/logo/`), a lazy chunk loaded only under the param, until Alex picks in
the `Look: pick the new logo` issue; the pick then becomes the default (poster, score card, share card) and the rest
are deleted. A concept's car ride runs on rAF, not SMIL, so `npm run clip`'s virtual time steps it like the page.
**Consequences:** Don't put a beat-driven pulse back on the logo. The startup JS carries no concept code.
