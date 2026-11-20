## 2026-11-20 — The loop logo is the default; no light sweep, no `?logo=` (Builder, #538)

**Context:** The #476 entry (2026-11-13) kept the wordmark's light sweep and put logo concepts live behind
`?logo=<name>` (`ui/screens/logo/`) until Alex picked one. He picked the loop logo in #532, and #537 made it the
default and deleted both the sweep and the concepts.
**Decision:** The loop logo is the logo everywhere: title, poster, score card and share card. Its shapes live only in
`src/ui/logoArt.ts`, drawn twice from there: as SVG by `screens/TitleLogo.tsx` and on canvas by `scoreCardImage.tsx`
`drawLogo`. The poster in `index.html` inlines `TitleLogo`'s still markup, kept equal by `src/app/indexHtml.test.ts`.
The score card draws with the 2D canvas API on purpose: an SVG drawn as an image can't use the page's Lobster font.
This supersedes the #476 entry's "the wordmark keeps the light sweep" and `?logo=` clauses; its rule of no
music-driven logo motion stands.
**Consequences:** Change a logo shape in `logoArt.ts` and both renderers follow; change how one renderer draws and
check the other. Don't add an SVG-as-image path to the score card, and don't bring back a `?logo=` switch for a
settled logo.
