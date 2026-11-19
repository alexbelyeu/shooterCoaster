## 2026-11-19 — Trackside enemies on a blind approach; scorpions circle their spot (Builder, #494)

**Context:** Desert's opening climb pitches the rider at the sky while the track past its crest drops and turns away:
no spot within the trackside band (400) of the slots' stretch of track is in view from it, so 4–7 s showed one
scorpion. Scorpions also crawled in a straight line at 48–120 units/s, hundreds of units out of the view their
placement chose within seconds.

**Decision:** A ground trackside slot whose near-track spots are all out of view on its approach stands out along the
look from the middle of that approach (`spawnPlacement.ts` `whereTheApproachLooks`), beyond the band, off every rail by
`sideMin` and out of the biome's `keepOff` circles (`BiomeDefinition.keepOff`), when more of the approach's looks see it
than the best near-track spot. Not in an interior (bounds): its boulders and pieces have no `keepOff`. The scorpion
scuttles round a 20-unit loop through its spawn instead of crawling away.

**Consequences:** A biome with ground trackside enemies and a landmark or big prop off the track lists it in `keepOff`
(desert, volcanic, arctic do). Making the scorpion wander off again undoes the placement.
