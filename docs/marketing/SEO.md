# SEO and link previews

The checklist for scoaster.com's search and share metadata (#193). The Marketer and builders
follow it; re-check the sources when you change anything here, since the guidance moves.
Everything below is checked automatically: `scripts/site.test.ts` (routing, headers, share card,
manifest, icons, 404 page), `src/app/indexHtml.test.ts` (JSON-LD, `#about` text) and the
Lighthouse gate (`npm run lighthouse`, part of `npm run verify` and CI).

## Sources (read 2026-10-31)

"Updated" is the page's own last-updated date where it shows one.

| Topic | Source | Updated | What applies to us |
|---|---|---|---|
| JavaScript SEO, SPAs, status codes | [Understand the JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | 2026-03-04 | Use real status codes (404 for missing pages); an SPA that answers every path with 200 makes soft 404s. Keep one `rel=canonical` in the HTML and never change it from JS. Pages that return 200 go to rendering. |
| Fixing JS search problems | [Fix Search-related JavaScript problems](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript) | 2025-12-18 | Soft 404 fix for SPAs: serve a real 404 or `noindex` the error view. Fingerprint file names (Googlebot caches hard). Feature-detect WebGL and keep crawlable content without it (our `#about` text). |
| Robots meta | [Robots meta tag, data-nosnippet, and X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | 2026-03-24 | `max-image-preview:large` allows a large image preview; `X-Robots-Tag` works on any response (we have no non-page responses that need it). |
| Structured data | [Software app (SoftwareApplication) structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app) | 2026-09-08 | `VideoGame` only counts as a co-type of a software app type; `applicationCategory` should be a supported value (`GameApplication`). A rich result also needs `aggregateRating` or `review`, which we don't have and must not invent. |
| Favicon in Search | [Define a favicon to show in search results](https://developers.google.com/search/docs/appearance/favicon-in-search) | 2026-10-27 | Square, larger than 48×48 recommended, `rel="icon"`, crawlable, stable URL, one per hostname. |
| Sitemaps / lastmod | [Sitemaps ping endpoint is going away](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping#the-lastmod-element) (Google, June 2023; summarised by [Vercel KB](https://vercel.com/kb/guide/correct-lastmod-nextjs-sitemap)) | 2023-06 | The ping endpoint is gone: submit the sitemap in Search Console. `lastmod` is used only when it is consistently accurate and tracks significant changes (main content, structured data, links). |
| Lighthouse SEO audits | [Lighthouse SEO audits](https://developer.chrome.com/docs/lighthouse/seo/meta-description) | (nav 2019-05-02) | meta description, link text, hreflang, canonical, HTTP status, robots.txt, plugins, tap targets; structured data is a manual check. |
| Lighthouse Best Practices | [Lighthouse Best Practices audits](https://developer.chrome.com/docs/lighthouse/best-practices/doctype) and [CSP against XSS](https://developer.chrome.com/docs/lighthouse/best-practices/csp-xss) (2021-06-16) | (nav 2019-05-02) | Doctype, console errors, charset, viewport, HTTPS, no vulnerable libraries, deprecations. The CSP / HSTS / clickjacking / Trusted Types / COOP checks are listed under security; the recommended CSP is nonce-based with `strict-dynamic`, which needs a per-request nonce. |
| Web app manifest | [web.dev: Web app manifest](https://web.dev/learn/pwa/web-app-manifest) | 2024-12-09 | 192 and 512 px icons, a maskable 512 with the artwork inside the centre 40% radius, no transparency; `display` `fullscreen` / `standalone`; `.webmanifest` served as `application/manifest+json`. |
| X / Twitter | [Summary card with large image](https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image) | (none shown) | `twitter:card` + `twitter:title` required; image 2:1, ≥ 300×157, ≤ 4096×4096, ≤ 5 MB, JPG/PNG/WEBP/GIF (no SVG); `twitter:image:alt` ≤ 420 chars. |
| WhatsApp | [WhatsApp link previews](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/) | (none shown) | `og:title`, `og:description`, `og:url` in `<head>`, within the first 300 KB of the HTML; image **under 600 KB** (the tightest weight limit of any unfurler), ≥ 300 px wide, aspect ≤ 4:1. |
| Discord | [Discord Open Graph meta tags](https://wildandfreetools.com/blog/discord-open-graph-meta-tags) (secondary, 2026-03-27; Discord publishes no unfurl spec) | 2026-03-27 | Reads `og:*` and `theme-color` (the embed's accent bar), not `twitter:*`; a wide image ≥ 400 px shows large, square shows as a thumbnail; no JS; caches per message. |
| Bluesky | [Website card images for Bluesky](https://htmlcsstoimage.com/features/og-images-for-bluesky) (secondary) | (none shown) | The `Bluesky Cardyb` crawler reads `og:*` from the static `<head>`; 1200×627 landscape; caches its own copy. |

Not readable from agent sessions on 2026-10-31 (blocked or robots-disallowed), so their numbers
below come from secondary sources and memory and are marked *unverified*: the
[Open Graph protocol](https://ogp.me/) itself, Facebook's
[Sharing for webmasters](https://developers.facebook.com/docs/sharing/webmasters), Slack's
[Slackbot unfurling](https://api.slack.com/robots), LinkedIn's
[Make your website shareable](https://www.linkedin.com/help/linkedin/answer/46687), Apple's
[TN3156: Create rich previews for Messages](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)
and Reddit (no public spec). A Marketer with a browser should re-read them and update this table.

## Share card limits we design to

| Platform | Image | Weight | Notes |
|---|---|---|---|
| WhatsApp | ≥ 300 px wide, ≤ 4:1 | **< 600 KB** | Tightest weight limit: it sets our cap |
| X | 2:1, ≤ 4096 px | ≤ 5 MB | `summary_large_image`, alt ≤ 420 chars |
| Facebook / Meta | 1200×630 recommended (*unverified*) | ~8 MB (*unverified*) | Re-scrape with the Sharing Debugger after a change |
| LinkedIn | 1200×627 (*unverified*) | ~5 MB (*unverified*) | Re-scrape with Post Inspector |
| Discord, Slack, iMessage, Reddit, Bluesky | wide 1.91:1 renders large | — | All read `og:*` from static HTML; none run JS |

Our card: `public/social/og-1200x630.jpg`, 1200×630 JPEG, capped at 300 KB by `npm run og`
(well under WhatsApp's 600 KB). One wide image serves every platform; a square fallback is not
needed (Discord and Slack show wide images large, a square one only as a thumbnail).

## Checklist

**Crawling and indexing**
- [x] Real 404s: unknown paths get `404.html` (`noindex`, links home) with status 404. `vercel.json` rewrites only `/go/*` (campaign paths, #171) to the game; everything else is a file or a 404. Tested by the route model in `scripts/site.test.ts`.
- [x] One `rel=canonical` (`https://scoaster.com/`) in the static HTML, so `/go/<campaign>` visits fold into `/`. Not touched by JS.
- [x] `robots.txt` allows everything and names the sitemap.
- [x] `sitemap.xml` lists `/`. **No `lastmod`:** the one URL is the game, which deploys several times a day, so a build date would be "every deploy" rather than significant changes, and Google ignores dates that aren't accurate. Add `lastmod` only if the site grows real content pages.
- [x] Crawlable text without WebGL or JS: the visually hidden `#about` (#101): one `h1`, names every world, how to play.
- [x] `lang="en"`, `<meta charset>` first, viewport tag. No `hreflang` (English only).
- [ ] Search Console + Bing Webmaster Tools verified, sitemap submitted: Alex, #274 (DNS TXT record, so no tag in the page).
- [ ] IndexNow: not adopted. One URL that Bing can read from the sitemap; IndexNow would need a key file and a build-time ping to another origin. Revisit if the site gets many pages.

**Search appearance**
- [x] Title (≤ 60 chars) and meta description (≤ 160 chars) that say what the game is.
- [x] `max-image-preview:large` robots meta.
- [x] JSON-LD `["VideoGame", "WebApplication"]`, `applicationCategory: GameApplication`, free `Offer`. No rating or review: Google won't show a rich result without one, and we never invent one.
- [x] Favicon: `favicon.ico` (16/32/48 px) at the site root and `favicon.svg`, both `rel="icon"`, from one master (`public/favicon.svg`); `apple-touch-icon.png` 180 px. Keep the URLs stable.

**Share card** (all in the static `<head>`, absolute `https://` URLs)
- [x] `og:type`, `og:site_name`, `og:locale` (`en_US`), `og:url` (= canonical), `og:title`, `og:description`.
- [x] `og:image` + `og:image:secure_url`, `:type`, `:width`, `:height` (match the file), `:alt`.
- [x] `twitter:card` `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`.
- [x] `theme-color` (Discord's embed bar, mobile browser chrome).
- [x] Cache busting: platforms cache cards for hours to days. When the card changes, give the image a new file name (e.g. `og-1200x630-v2.jpg`) and re-scrape on Facebook and LinkedIn (#274 lists the tools).

**App and headers**
- [x] `site.webmanifest`: name, `id` / `start_url` / `scope` `/`, `display: fullscreen`, theme and background colours, 192 / 512 / maskable 512 icons (all from `favicon.svg`, `npm run og -- --icons`). Not in the portal build.
- [x] Headers on every path: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb, browsing-topics off), `Cross-Origin-Opener-Policy: same-origin`. Vercel adds HSTS on its own.
- [x] `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` only: Vite's hashed bundles. Nothing unhashed may live in `public/assets/` (tested).
- [ ] **No CSP yet.** Lighthouse's recommended policy is nonce-based with `strict-dynamic`, which needs a fresh nonce per response; scoaster.com is static files with no server to mint one. An allowlist CSP would also need `'unsafe-inline'` for the JSON-LD and the `#about` styles and room for Vercel Analytics' injected script, and Lighthouse rates such policies as bypassable anyway. Revisit with a Vercel middleware if the site ever handles user input.
- [ ] **No `X-Frame-Options` / `frame-ancestors`.** The page has nothing to clickjack (no account, no purchase), and other sites may want to embed the game in an iframe. Revisit if that changes.

## Lighthouse gate

`npm run lighthouse` (after `npm run build`; needs `SC_CHROME` in cloud sessions) runs
Lighthouse 13 once on mobile emulation and once on desktop against `vite preview` of `dist/`,
writes `e2e-results/lighthouse.json` and fails below **SEO 100, Accessibility 95, Best Practices
95**. Performance is printed, never gated: a WebGL game drawn by software GL in a headless
browser isn't a fair score. `--form mobile|desktop` runs one; `--url` points it at a running server.

`vite preview` doesn't send the `vercel.json` headers, so the gate can't see them; the unit
test checks them instead.

**Baseline (2026-10-31, #193, software GL in a cloud session):**

| Form factor | SEO | Accessibility | Best Practices | Performance (report only) |
|---|---|---|---|---|
| Mobile | 100 | 100 | 100 | 27–39 |
| Desktop | 100 | 100 | 100 | 45–67 |

Performance swings ±15 between identical runs on software GL; compare only large moves.
