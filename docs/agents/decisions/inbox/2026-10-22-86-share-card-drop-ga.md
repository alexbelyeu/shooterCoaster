## 2026-10-22 — Share card and SEO head; Google Analytics removed (Builder, #86)

**Context:** Links to the game unfurled with no image and a "voxel" description. Alex
chose Vercel Web Analytics as the only analytics (`2026-10-22-setup-marketer.md`), so the
Google Analytics `gtag` block in `index.html` was a leftover third-party runtime call.

**Decision:** The `gtag` script is removed; the game makes no Google network calls. The
`<head>` carries one block of share/SEO tags with absolute `https://scoaster.com/` URLs
(canonical, `og:url`, `og:image`), even while the vercel.app alias also serves the site.
The card is a real gameplay frame rendered by `npm run og` (`scripts/og-image.mjs`) and
committed as `public/social/og-1200x630.jpg`. It is a JPEG, not a PNG: a PNG of a rendered
scene at that size is far over the 300 KB budget for unfurl images. `robots.txt` and
`sitemap.xml` are static files in `public/`, which Vercel serves before the SPA rewrite.

**Consequences:** Re-run `npm run og` and commit the result when the game looks better.
Portal builds edit only that head block. Adding analytics or any other third-party script
back needs its own decision entry.
