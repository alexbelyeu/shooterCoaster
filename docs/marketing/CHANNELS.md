# Channel log

One row per post or campaign, filled in by the Marketer from the closed `marketing`
issues and the weekly metrics. Empty until the first post goes out (Stage 1 in
STRATEGY.md). Setup asks (analytics, domain) are not channel actions and are not logged here.
Attribution per row = visitors on the campaign landing path (`requestPath = /go/<campaign>`)
plus visitors with the channel's referrer hostname, both from the weekly metrics file; UTM
parameters are on the links but Vercel Pro cannot break them down (README).

| Date | Channel | Action (issue) | Link / UTM | Result (visitors, notes) |
|---|---|---|---|---|
| – | – | No posts or campaigns yet (as of 2026-11-16). #102 (three.js Showcase) was GO for 2 Nov, re-dated to 9–13 Nov and closed unposted on 16 Nov under the three-week rule; #308 (Reddit) is open and waits with it on #610, Alex's answer on what the first post waits for (STRATEGY.md). **Baseline for every row below, three weeks with no posts: 26–37 visitors a week, 100 % direct bar 2–3 github.com / google.com visits; W46 had the first 4 non-Alex players (7 starts, 2 completes)** (metrics/2026-W44.md – 2026-W46.md) | – | – |
| 12 Nov | SEO (google.com) | Search Console + Bing set up by Alex (#274, 9 Nov) | – | First search referral: 1 visitor in W46. Tracked weekly from here |
