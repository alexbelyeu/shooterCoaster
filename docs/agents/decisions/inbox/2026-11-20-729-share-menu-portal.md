## 2026-11-20 — The share menu lives outside the results board (builder, #729)

**Context:** A `FairBoard` cuts its notched ticket corners with a CSS `mask`, which clips everything inside it. The
share menu hangs off the Share plate past the board's edge, so inside the board it was cut in half.
**Decision:** `ShareMenu` portals its menu to `document.body`, `position: fixed` at the viewport point
`popoverPlacement.ts` returns (`{ side, left, top }`), and closes on scroll or resize like it already did on resize.
Any other popover that hangs off a fair board needs the same.
**Consequences:** the menu's DOM no longer sits inside `.share-anchor` / `.results-actions` (the smoke finds it by
`.share-menu`); outside-click checks test the anchor and the menu.
