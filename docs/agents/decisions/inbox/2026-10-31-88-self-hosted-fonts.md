## 2026-10-31 — Self-hosted OFL fonts; portal build (builder, #88)

**Context:** The portal zip (itch.io, Newgrounds, CrazyGames) may not call other origins,
and `global.css` loaded Lobster + Inter from Google Fonts (the 2026-10-19 decision that
accepted that call named self-hosting as the way out). ASSETS.md allows only our own or CC0
assets without a decision.

**Decision:** Vendor the latin-subset woff2 files of Lobster and Inter (SIL OFL 1.1, which
allows bundling and redistribution with the licence) in `public/fonts/` beside their licence
texts, and use them in **every** build, not only the portal one. Both builds then make no
third-party request at runtime; this supersedes the 2026-10-19 Google Fonts exception. OFL
fonts are an accepted exception to the CC0-only asset rule; any other font still needs its
own entry. The portal build is `vite build --mode portal` (`base: './'`, no analytics, no
share-card tags); the normal build keeps `base: '/'`.

**Consequences:** ~80 KB of fonts come from our origin instead of Google's. Characters
outside the latin subset fall back to system fonts, as before for anything our English text
uses. The smoke fails if either face does not load, or on any request that leaves the
page's origin in a local run.
