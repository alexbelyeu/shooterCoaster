## 2026-10-22 — Vercel Web Analytics, page views only, off for test traffic (Builder, #59)

**Context:** Alex wants to see real players on the live site, and the weekly Marketer
reads Vercel Web Analytics. Hard rule 4 needs an entry for a new runtime network call.
**Decision:** Add `@vercel/analytics` and mount `<Analytics />` in `src/main.tsx`. The
call is first-party and same-origin (`/_vercel/insights/script.js`, then
`/_vercel/insights/view`), cookieless; it sends the page URL, referrer and the
country / browser / OS / device type Vercel derives from the request. No custom events:
the project lives in the default personal team, which we take to be Hobby (the API
does not report the plan): 50,000 events/month shared across all projects, 1-month
reporting window, and custom `track()` events need Pro. The component is mounted only when the
build ran on Vercel (`VERCEL=1` → `__BUILT_ON_VERCEL__` via `define`) and the URL has no
`e2e` param (`src/app/analyticsGate.ts`), so dev, `vite preview`, CI and both smoke runs
(CI and nightly production) send nothing and never hit a missing `/_vercel` route.
**Consequences:** One page view per load (the app has no routes). Collection starts only
after Web Analytics is switched on in the Vercel project's Analytics tab, a dashboard
action for Alex. If the plan moves to Pro, `level_start` / `level_complete` / `share`
events can be added with `track()` from `@vercel/analytics` (Pro allows 2 properties per
event). Do not add another analytics tool (Alex, 2026-10-22).
