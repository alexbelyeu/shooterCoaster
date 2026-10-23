## 2026-10-23 — Analytics custom events from store phase changes, 2 properties max (Builder, #98)

**Context:** The team is on Vercel Pro (Alex, 2026-10-22), so Web Analytics custom events
are available. They count against the plan's event allowance, and Pro records at most 2
properties per event.
**Decision:** `src/app/analyticsEvents.ts` maps game-store phase transitions to
`level_start` {level}, `level_complete` {level, stars} and `level_quit` {level,
progress_pct in tens}. `src/main.tsx` subscribes to the store and calls `track()` only
behind the existing `analyticsEnabled` gate, so dev, `vite preview`, CI and smoke runs send
nothing. Events come from the store, not from UI buttons, so every way into or out of a run
is covered once. `level_complete` carries `stars` rather than a score bucket because a third
property would be dropped on Pro; stars is the game's own score bucket. No `share` event
until the game has a share action. Pause/resume and tab close send nothing.
**Consequences:** A run sends at most two events. Adding an event or property means
checking the 2-property limit and updating the table in `docs/marketing/README.md`. If the
team adds Web Analytics Plus (8 properties), a `score_pct` property can be added to
`level_complete`.
