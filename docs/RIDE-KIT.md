# Ride kit: make every ride a thrill

Alex, 19 Nov, after riding level 6: "the circuit in general is missing pizazz, very lackluster. Make it
way more fun. Think outside the box, we might use some of these ideas for the other levels."

This is the design every ride is built and judged against. The elements are generic (`src/track/`),
so any level, including new ones from `npm run new-world`, can use them; each level's ride is a
storyboard of them. Epic: see the issue that links this file.

## Why the rides feel flat

- **One speed.** The gym's `rollerSpeed` was 0.0000004 (before its v2 ride): gravity was off, every metre ridden at the
  same speed (`ridePhysics.ts`). There is no tension and no release.
- **No use of the space.** The gym hall is 80 × 40 × 27 m; the ride peaks at 5.4 m. Outdoor levels
  have whole landscapes and ride a ribbon a few metres over the ground.
- **No elements.** No launch, no lift hill, no drop, no airtime, no inversion, no near miss.
- **No beginning or end.** The run starts mid-scene (level 6: inside the Tree's gap) and stops
  when the timer does.
- **The camera doesn't sell it.** Speed changes barely show in the field of view, the horizon or
  the sound.

## Principles

1. **Rhythm: tension, then release.** A slow climb (the chain clanks, you look around, enemies
   come into range) and then an explosive drop. Never more than ~5 s of the same feeling.
2. **Use the whole volume.** Go high (the roof, the trusses, the peaks), go low (skim the floor,
   the mats, the water), go tight (through caves, gaps, between holds).
3. **Near misses everywhere.** The track should look like it will hit something, and not:
   head-choppers under beams, threading gaps, skimming walls. Safe by the clearance rules,
   scary by the eye.
4. **Every set piece is also a shooting moment.** Crests and airtime are slow: that's where
   enemies cluster (with a short slow-motion window). Fast stretches are for the view and the rush.
5. **A start and an ending.** A launch out of a station after the countdown; a finale, a brake
   run and an on-ride photo.
6. **Always readable.** The rider sees where the track goes next; an inversion never hides the
   targets the level expects them to shoot; phones included.

## Elements (generic, `src/track/elements/`)

Each element is a pure builder of control points plus markers (where the launch fins, the chain,
the slow-motion window, the photo are), so camera, audio, pacing and spawning can react.

Built so far (#698): `src/track/elements/` has the loop, zero-g roll, corkscrew, heartline roll, airtime hill
(with its `slowMotion` marker), helix, banked turn and the head-chopper helper, on a `RideBuilder` whose control
points carry the track's `up`; `climbing.ts` has the unmarked pieces a ride laid out on a floor plan uses (#757: a straight
or a turn that climbs on the way, a straight to a line on the plan; a turn, and so a `bankedTurn` with `rise`, climbs a little more than `rise`, its grade's share by 1 / cos g; a straight throws on a rise over ~5.8 × its run, #815), which level 6's ride is built from; a spline with ups rolls, and the ride camera's up follows it. See them ridden with
`npm run turntable -- --rides` (`e2e-results/turntable/rides.png`).

The special mechanics (#699) are `TrackParams.mechanics` on a v2 ride, built with their track by `src/track/elements/mechanicElements.ts`:
a **station** the ride starts in (GO launches it over fins), a **drop track** (the car stops on a piece of track that
free-falls with it and locks into the track below), a **jump gap** (a booster sets the speed its ballistic flight was
built for; no rails across) and a **backwards** stretch between two turntables. Their stops last their seconds whatever
the beats' solver does to the stretches round them. `rides.png`'s second half rides them (`mechanicsRide.ts`).
On a backwards stretch (`withBackwards` puts it on the level's arc table) the spawner looks where the seat does (#716):
`trackView` turns the look half round, and a formation group the rider meets there lies back along the track already
ridden, never ahead of where the rider is when it lands. Trackside and wall waves only get the honest view check: their
slots are still laid ahead, so keep those off the stretch.
A **junction** (#702, `kind: 'junction'`, on either ride but only a spline track) is the shoot-to-switch: a branch through
its `points` from the fork at `from` to the merge at `to`, with a switch sign before the fork. The ride's timing stays on
the main track, so the branch is ridden faster; no other mechanic may sit between its sign and its merge (`checkMechanics`).
`checkMechanics` also refuses a second junction on one track (the run has a single `route` and the sign a single collision
target, #725) and a fork so near the lap's start that its sign (a tenth of the span before `from`) would stand before 0.
Only the seat, the rails and the sign know the branch: towers (`planTowers`), scenery clearance (`trackClearance.ts`,
`trackScatter.ts`) and enemy placement all use the main curve. So the branch gets no support towers, and a junction's
level proves its branch clear of the scenery, the ground and the rest of the track itself, as `gymTrack.test.ts` does.

| Element | What it does | Feel |
|---|---|---|
| Launch | Standing start in a station, 0 → top speed in ~2 s on magnetic fins | Whoosh, FOV kick, pushed into the seat |
| Lift hill | Slow climb on a chain to the highest point | Clank-clank, the view opens, enemies in range |
| First drop | Steep (≥ 60°) drop from the top | Stomach drop: camera dips, wind roars |
| Airtime hill | A crest you float over | Weightless; a short slow-motion window for shots |
| Inversions | Vertical loop, zero-g roll, corkscrew, heartline roll | The world turns over; the camera's up follows the track |
| Helix | Long banked spiral | Sustained G, the scene wheels round |
| Head-chopper | Pass ~1 m under / beside a beam, a ledge, a wall | Flinch |
| Dark section | A tunnel or cave in darkness with its own light (blacklight, lava, bioluminescence) | Surprise, then glow |
| Splash / burst | A low point that throws water, dust, chalk or snow | Impact |
| Drop track / free fall | A piece of track drops with the car (drop tower, auto belay) | Free fall |
| Jump gap | The rail breaks; the car flies a short arc to the next rail | "Did that just happen?" |
| Backwards | A turntable turns the car; ride (and shoot) backwards | Disorientation |
| Shoot-to-switch | A switch target before a junction; hit it to take the harder branch | Choice, replay value, more points |
| Brake run + photo | Slow-down at the end; a flash at a key moment becomes the share card's photo | A souvenir, and marketing |

Speed is real (gravity on, launches and lift hills add or set speed) and every timed moment (a
boss's arrival, a wave's window) is still guaranteed: the ride's speed profile is solved ahead of
time so the storyboard's beats land on their seconds.

## Level 6: the Climbing Gym, storyboard (60 s)

As built (#761: slowed and spread out for comfort at the rider's scale; `gymTrack.ts` has the seconds each beat lands):

1. **0 s, station on the black path.** Countdown; **launch** north up the path, climbing at the Flame.
2. **~6–11 s, over the Flame.** A wide braking turn onto it and a **slow heartline roll** across it (~5 s): the
   flames over your head at its middle. (The first build's zero-g roll took a second; a whip like that is dizzying.)
3. **~11–18 s, the Training Area.** Down under its lintel (a **head-chopper**) into the cave as a **dark section**,
   round north through it: blacklight, the holds glowing, rats lit by the muzzle flash.
4. **~18 s, the route choice.** Out of the cave on a launch across the hall: a **shoot-to-switch** sign, V2 (the
   easy way) or V8 (the harder branch, more points).
5. **~21.5 s, the wall ride.** A **lift hill** straight up Alaska, climbers and lanternflies on the wall beside and
   above you, to the roof trusses at ~21 m, rolling onto its back to tip over north.
6. **~26 s, the dyno.** A **jump gap** off Alaska's top to the Shield.
7. **~28 s, the auto-belay drop.** A **drop track**: the car stops, then falls upright with its piece of track into
   the pit.
8. **~36–44 s, Medusa.** A **helix** up out of the pit that comes out facing the Starr as she rises (40 s), then a
   slow chain lift straight at her face.
9. **~44 s, the dive** round her shoulder, along the Tree's roots, a hairpin into its left cave.
10. **~54–59 s, the Tree.** A slow **heartline roll** through the gap between the solid trunk and the wall.
11. **After the run, home.** Down the hall's east side and under the **Arch's** lintel (the head-chopper the first
    build had at ~8 s: the slower ride has no time for the detour to it in the run) into the station.

## The other levels (ideas for their storyboards)

- **Theme Park (1):** built (#863, `themePark/parkTrack.ts`, its storyboard and seconds at the top): a station
  launch, a lift hill over the park, a 60° first drop past the big Ferris wheel into the tunnel, two camelbacks,
  the near miss beside the small wheel's gondolas (28 s), a second lift cresting as the blimp arrives (40 s), a slow
  helix round the carousel for the boss fight and a last hill into the brake run. The photo waits on #701.
- **Desert (2):** the drop into the Pyramid as a dark ride (torches, the Scorpion's lair), a jump
  gap over a canyon between mesas.
- **Ocean (3):** built (#865, `ocean/oceanTrack.ts`, its storyboard and seconds at the top): a lift east, a crawl
  south along its crest with the whale breaching ahead, the drop's splashdown into a glass tunnel under the sea, camelbacks,
  a slow corkscrew through a sea arch (`environment.seaArch`), the second lift cresting as the Kraken rises, the fight run
  east across the open lagoon facing it (40–50 s), and a quarter helix home along the north shore. No U-turns after the corkscrew: a hairpin or a half helix puts trackside
  waves behind the rider on their approach (`spawnPlacement.test.ts`).
- **Antarctica (4):** built (#866, `arctic/arcticTrack.ts`, its storyboard and seconds at the top): a station launch,
  a lift up the valley, a 71° first drop into the ice cave (a dark section with the `ice` look, `IceCave.tsx`, its mouth
  low over the rails), a second lift up the ridge, an airtime crest heading into the aurora (27 s), a 1.25-turn helix
  down past the Ice Fortress ending as the Yeti arrives (40 s), and the valley run home.
- **Inferno (5):** built (#867, `volcanic/infernoTrack.ts`, its storyboard and seconds at the top): a station
  launch through a glowing lava tube, a lift up the volcano's flank into a hole, a drop track falling inside the cone
  (18 s), out through a second hole a few metres round the rider (the near miss), two camelbacks (30 s), a turntable
  (38 s) and the Titan's whole fight ridden backwards facing him (40–57 s).

## Rules for building rides

- **Comfort, checked on every level** (`src/track/rideComfort.ts`, `rideComfort.test.ts`, #761): no 2 s stretch whose view
  turns faster than 110°/s on average, at most 4 s of the run over 90°/s, no 0.1 s snap over 350°/s. Levels 1–5 sit
  inside it; level 6's first rebuild went to 280°/s for seconds and snapped at 900°/s in a hall too small for its speed,
  and Alex found it dizzying. Speed is the lever: halve the speed and every turn rate halves. An inversion is a slow,
  floating roll (3 s or more), never a whip.
- **Something to shoot through every element** (principle 4, checked): the smoke's `pacing` step holds each level to its
  `budgets.json` `pacing` ceilings (longest gap with no target, share of the run with none), and CI runs it on every PR
  that touches a level's ride or spawns. Spawns follow the ride: when the route changes, its targets move with it; on a
  climb the targets are on the wall beside and above the rider, during an inversion they stay in frame.

### What the rider must see (#925, from Alex's playtest of the gym, 23 Nov)

The gym's ride passed every gate and was, in Alex's words, a complete disaster: nine seconds of nothing at the jump and
the drop, the Medusa on screen for two seconds, a sixteen-second crawl round the Tree with nothing to shoot. The gates
counted any live enemy whose centre projected into the viewport, so enemies behind walls, under the floor or specks
across the hall all counted. These rules come from that playtest; each says how it is checked.

1. **A target counts only if the rider can shoot it** (checked). `__SC_TEST__.sight()` (`src/testing/lineOfSight.ts`)
   counts a live enemy or exposed weak point only when it is inside the view, at least `MIN_ENEMY_PX` and has a clear
   line from the camera (no opaque mesh in front of it). The `pacing` gate and the review run on that count, played as a
   player who lands 3 hits a second on what they can see (`PLAYER_HITS_PER_SECOND`): a stretch only leftovers would fill
   is empty.
2. **Every element is a shooting moment** (checked by `pacing`): a spin, a roll, a jump, a drop and a lift hill each
   get targets placed where the rider looks during it, not where the track was a second earlier. A roll over a set
   piece puts the targets round the set piece, in frame through the roll.
3. **Set pieces happen where the action is** (seen in the review): a jump, a drop or an inversion faces a landmark and
   has a wave on it. A thrill against a blank corner of the hall is wasted seconds.
4. **The boss fight is framed** (checked: `pacing.bossFramedShare`, `bossFraming` in `e2e/pacingMetric.mjs`): from
   the boss's arrival, one of its weak points is shootable for at least that share of the fight (60% unless the level's
   budget says more). The ride turns round the boss, not away from it, and the run ends on the fight: the finale is the
   climax, never a slow crawl past empty scenery.
5. **Waves last** (seen in the review): a wave's enemies spread along the stretch they belong to and stay there (on
   walls, perches, slow orbits), so it is a stretch of shooting, not one cluster killed in a one-second burst at its tell.
6. **Storyboard beats are contracts** (checked in each ride's track test): every beat of a level's storyboard lands
   inside the run. A beat is not dropped, or moved after the run, to make something else fit; cut or move it only with
   Alex's OK on the level's `steering` issue (the gym's Arch went "after the run" in #761 without one).
7. **Effects look right from the seat** (seen in the review): look at every effect from where the rider passes it, above
   and inside included. No camera-facing sprite seen edge-on or from above, no flames under what is burning, no hard or
   pixelated sprite edges, and an effect fades before the camera goes into it.
8. **No flicker** (seen in the review's `flicker` list): a region of the screen that jumps in brightness for one step and
   comes straight back is a light popping, z-fighting or a blinking sprite. Find each spike's cause; explained ones (a
   muzzle flash, a kill) go in the PR.

**Every PR that changes a ride, its waves, a boss or a level's effects runs the ride review and posts it**:
`npm run build && npm run review -- --level <id>` (`scripts/rideReview.mjs`, about 3 minutes in a cloud session) writes
`e2e-results/review/<id>/sheet.jpg` (a frame every 2 s, each labelled with its time, track and what is shootable, red when
nothing is) and `review.json` (the timeline, gaps, the boss's framing, flicker). Look at the whole sheet before shipping,
put its summary lines in the PR body, and QA looks at it again.

- Clearance from **everything solid**, railings, stairs and props included, never only the
  blockout's pieces (level 6 rode through the pit's railing on 19 Nov because they weren't checked).
- A near miss is measured: the closest the rider's eye passes to a solid at speed, per element.
- Inversions: the rider's up follows the track's roll; the HUD stays upright.
- Phones: the same ride, the same elements; effects scale with the quality preset.
- Each level's ride storyboard lives at the top of its track file, with the second each beat lands.
