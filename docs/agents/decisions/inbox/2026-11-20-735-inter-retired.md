## 2026-11-20 — Inter retired; Big Shoulders is the page's default face (builder, #735)

**Context:** The score card was the last screen drawn in Inter. `html, body, #root` still named Inter as the default, so any element without its own `font-family` (and two canvas textures: the track switch sign and the `?perf=1` panel) fell back to it.
**Decision:** Remove Inter (font file, licence, `@font-face`, ASSETS row). The page's default face is Big Shoulders; the track switch sign and the perf panel use it too. The score card draws in Ultra and Big Shoulders from `FAIR` (`src/ui/theme.ts`), the `--fair-*` colours for canvas code, which `theme.test.ts` pins to `global.css`.
**Consequences:** `uiTells` `defaultSans` is 0, so lint now fails any `'Inter'` or monospace face in `src/`. Don't add Inter back as a "neutral" fallback: an element that needs a face picks Ultra or Big Shoulders (docs/art/PERSONALITY.md "Type").
