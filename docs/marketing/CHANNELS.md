# Channel log

One row per post or campaign, filled in by the Marketer from the closed `marketing`
issues and the weekly metrics. Empty until the first post goes out (Stage 1 in
STRATEGY.md). Setup asks (analytics, domain) are not channel actions and are not logged here.
Attribution per row = visitors on the campaign landing path (`requestPath = /go/<campaign>`)
plus visitors with the channel's referrer hostname, both from the weekly metrics file; UTM
parameters are on the links but Vercel Pro cannot break them down (README).

| Date | Channel | Action (issue) | Link / UTM | Result (visitors, notes) |
|---|---|---|---|---|
| – | – | No posts or campaigns yet (as of 2026-10-26; first draft #102 is scheduled for Mon 2 Nov, see STRATEGY.md). W43 baseline for comparison: 31 visitors / 47 views, 100 % direct, 18 level starts (metrics/2026-W43.md) | – | – |
