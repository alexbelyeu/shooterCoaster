# Assets and licences

Every non-code asset added to the game is listed here with its source and licence.
Allowed: assets created by code in this repo, or third-party assets explicitly
licensed CC0. Anything else needs a DECISIONS.md entry first.

| Asset | Path | Source | Licence | Added (PR) |
|---|---|---|---|---|
| Social preview card (1200×630 level-1 gameplay frame) | `public/social/og-1200x630.jpg` | Rendered from the game by `npm run og` (`scripts/og-image.mjs`) | Ours (procedural render) | #86 |
| Title posters (the title scene with no UI, 960×540 landscape and 540×1080 portrait WebP, 30 KB / 14 KB), shown by index.html before any JS | `public/poster/title-landscape.webp`, `public/poster/title-portrait.webp` | Rendered from the game by `npm run og` (`-- --poster`, `scripts/og-image.mjs`) | Ours (procedural render) | #376 |
| Site icon master (crosshair on sky, SVG) | `public/favicon.svg` | Hand-written SVG, the same shapes as the #86 apple touch icon | Ours (code) | #193 |
| Apple touch icon (180×180), `favicon.ico` (16/32/48, replaces the legacy coaster icon of unrecorded origin), manifest icons 192 / 512 / maskable 512 | `public/apple-touch-icon.png`, `public/favicon.ico`, `public/icons/` | `favicon.svg` rasterised on a 2D canvas by `npm run og` (`-- --icons`) | Ours (code-drawn) | #86, #193 |
| Lobster font, latin subset (`lobster-latin-400.woff2`) + licence `OFL-Lobster.txt` | `public/fonts/` | The Lobster Project Authors, woff2 from the `@fontsource/lobster` 5.3.0 npm package | SIL OFL 1.1 (DECISIONS: self-hosted fonts, #88) | #88 |
| Inter variable font, latin subset (`inter-latin-wght.woff2`) + licence `OFL-Inter.txt` | `public/fonts/` | The Inter Project Authors, woff2 from the `@fontsource-variable/inter` 5.3.0 npm package | SIL OFL 1.1 (same entry) | #88 |
