# Channel log

One row per post or campaign, filled in by the Marketer from the closed `marketing`
issues and the weekly metrics. Empty until the first post goes out (Stage 1 in
STRATEGY.md). Setup asks (analytics, domain) are not channel actions and are not logged here.
Attribution per row = visitors on the campaign landing path (`requestPath = /go/<campaign>`)
plus visitors with the channel's referrer hostname, both from the weekly metrics file; UTM
parameters are on the links but Vercel Pro cannot break them down (README).

| Date | Channel | Action (issue) | Link / UTM | Result (visitors, notes) |
|---|---|---|---|---|
| – | – | No posts or campaigns yet (as of 2026-11-09). #102 three.js Showcase was GO for Mon 2 Nov and #308 Reddit for 7–8 Nov; neither went out (no `/go/*` visit, no forum or Reddit referrer in W45), so both were rewritten and re-dated on 9 Nov: #102 to 9–13 Nov, #308 to the first weekend after Alex's playtest bar (#434 / #435 / #436), see STRATEGY.md. **Baseline for every row below: W44 = 37 visitors / 43 views / 8 level starts / 3 completes, 100 % direct, ≈ 5 visitors and 1 start a day** (metrics/2026-W44.md) | – | – |
