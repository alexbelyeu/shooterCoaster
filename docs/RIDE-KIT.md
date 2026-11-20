# Ride kit: make every ride a thrill

Alex, 19 Nov, after riding level 6: "the circuit in general is missing pizazz, very lackluster. Make it
way more fun. Think outside the box, we might use some of these ideas for the other levels."

This is the design every ride is built and judged against. The elements are generic (`src/track/`),
so any level, including new ones from `npm run new-world`, can use them; each level's ride is a
storyboard of them. Epic: see the issue that links this file.

## Why the rides feel flat

- **One speed.** The gym's `rollerSpeed` is 0.0000004: gravity is off, every metre is ridden at the
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
points carry the track's `up`; a spline with ups rolls, and the ride camera's up follows it. See them ridden with
`npm run turntable -- --rides` (`e2e-results/turntable/rides.png`).

The special mechanics (#699) are `TrackParams.mechanics` on a v2 ride, built with their track by `src/track/elements/mechanicElements.ts`:
a **station** the ride starts in (GO launches it over fins), a **drop track** (the car stops on a piece of track that
free-falls with it and locks into the track below), a **jump gap** (a booster sets the speed its ballistic flight was
built for; no rails across) and a **backwards** stretch between two turntables. Their stops last their seconds whatever
the beats' solver does to the stretches round them. `rides.png`'s second half rides them (`mechanicsRide.ts`).
On a backwards stretch the rider faces back but spawning still places waves ahead along the track, out of view, until
#716 places them for a rider facing back: keep a level's waves off the stretch until then.
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

1. **0 s, station by the entrance.** Countdown on the black pathway; **launch** straight down it
   at the Flame.
2. **~4 s, over the Flame.** Pull up and a **zero-g roll** over the fire: the flames are over your
   head for a moment.
3. **~8 s, the Arch and the Training Area.** **Head-chopper** under the Arch's lintel, then into
   the Training Area cave as a **dark section**: blacklight, the holds glowing, rats lit by the
   muzzle flash.
4. **~16 s, the cubbies.** Burst out over an **airtime hill** with a slow-motion window: the
   lanternfly swarm.
5. **~19 s, the route choice.** A **shoot-to-switch** sign at the cave's mouth: V2 (the easy way
   round) or V8 (the harder branch, more points). Grades as route names.
6. **~22 s, the wall ride.** The track bolted up the Shield like a top-rope climb: a **lift hill**
   up the wall, climbers beside you, the auto belay clicking, to the roof trusses at ~22 m. The
   whole gym below.
7. **~30 s, the dyno.** The rail ends at the top: a **jump gap** across to Alaska.
8. **~33 s, the auto-belay drop.** A **drop track** free fall down Alaska's face toward the pit.
9. **~40 s, Medusa.** A **helix** round the Starr pit while she rises and her snakes strike.
10. **~55 s, the Tree.** A **corkscrew** through the gap between the solid trunk and the wall.
11. **~58 s, home.** **Brake run**; the **photo** flash fires in the Tree's gap.

## The other levels (ideas for their storyboards)

- **Theme Park (1):** a classic: a station launch, a wooden-coaster lift hill, camelback airtime
  over the midway, a head-chopper through the Ferris wheel, the photo at the splash.
- **Desert (2):** the drop into the Pyramid as a dark ride (torches, the Scorpion's lair), a jump
  gap over a canyon between mesas.
- **Ocean (3):** a splashdown, a glass tunnel under the water with the Kraken passing overhead,
  a corkscrew through a sea stack's arch.
- **Antarctica (4):** an ice-cave dark section (blue glow), a bobsled helix down a glacier, an
  airtime hill off a ridge with the aurora.
- **Inferno (5):** a launch out of a lava tube, a drop-tower free fall inside the volcano, a
  backwards section as the Titan rises behind you.

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

- Clearance from **everything solid**, railings, stairs and props included, never only the
  blockout's pieces (level 6 rode through the pit's railing on 19 Nov because they weren't checked).
- A near miss is measured: the closest the rider's eye passes to a solid at speed, per element.
- Inversions: the rider's up follows the track's roll; the HUD stays upright.
- Phones: the same ride, the same elements; effects scale with the quality preset.
- Each level's ride storyboard lives at the top of its track file, with the second each beat lands.
