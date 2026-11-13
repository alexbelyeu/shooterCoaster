# Level blockouts

`src/levels/environments/biomes/gym/blockout.json` is Alex's blockout of his real climbing gym
(12 Nov 2026, #513), built from the gym's Setter's Map and his photos; keep it verbatim. Level 6 is
built from it: the pure `blockout.ts` next to it reads it as typed pieces (their solid boxes, the
named anchors: pit, star, Arch opening, Flame, Tree face, glass room windows) and scales it to the
level (`GYM_SCALE`, 16 world units per metre: the 80 m hall is 1280 units long). Don't name the real
gym anywhere: in the game it is "the Climbing Gym".

## The ride (#514)

`gymTrack.ts` builds the level's authored `spline` track from those anchors; `gymTrack.test.ts`
proves the four moments below, the clearances and the ~60 s lap. `gym-track.svg` here is its plot
(re-draw it with `node scripts/plot-gym-track.mjs docs/levels/gym-track.svg`): from GO, up the
Tree's face (0–3 s), a full turn round the Flame (~10–25 s), west through the Arch (~33 s), a right
turn to the crest by the glass gym room (~39 s), then the run-in down the west side into the Starr
pit with the star ahead, where the 60 s run ends; the U-turn under the star closes the lap after it.
The Medusa rises from the star at 40 s, as the rider leaves the crest facing it.

## Axes and units

Metres. Hall 80 × 40 × 27 (x × z × height). `x` runs the long way, 0 at the Starr end
(north) → 80 at the south end; `z` runs across, 0 on the east side (the Tree, the Training
Area, the Lagoon) → 40 on the west side (the Shield, Alaska, the Slab). The level scales
the whole blockout uniformly to landmark size (one `GYM_SCALE`), keeping its proportions.

## Piece format (`kind` → fields)

Every piece has `x, z` (centre, m), `rot` (degrees; a piece faces local +z, so 0 faces +z,
90 faces +x, 180 faces −z, 270 faces −x), `base` (y of its foot; −2.45 = the pit floor),
`name` and `note` (paint and character: read it).

- `sport` / `boulder`: a wall `length` m wide. `profile` is its panels bottom to top, each
  `{len, angle}`: 0° vertical, + overhangs toward the climber, − is a slab. Optional
  `ropes`, `color`; `back` is the depth behind the face.
- `tree`: `width, trunk, caveDepth, caveHeight, height, headAngle`: a trunk in the middle, a
  cave each side overhanging forward to meet the trunk at `caveHeight`, a headwall on top.
- `block` (freestanding boulder): footprint `w × d`, corners cut by `chamfer`; `profile`
  bands push every side out (+) or in (−); `color` / `colorB` paint the −x half (body /
  base band), `color2` / `colorB2` the +x half.
- `arch`: `length` span along local x, `d` passage depth along local z, `height`, a
  round-topped opening `opening × openingHeight`, `flare`; `attached: true` = its +x end is
  built into a wall.
- `star`: `points, radius, inner, depth, colorA, colorB`, mounted on a wall face.
- `pit`: `w × d`, `depth` down. `stairs`: the top step at the origin (`base` = top height),
  going down along local +z; `w, steps, rise, run`.
- `floor`: a slab with its top at `base` (a room floor or roof). `pad`: a mat `thick` m
  thick. `prop`: a box `w × d × h`.
- `windows`: `count` windows, each `winW × h`, along `length`, sill at `base`, on a hall
  wall facing in. `autobelay`: the device at `base` (a wall's top), with webbing and a black
  "CLIP IN" flag on the floor below.

## The four ride moments (Alex)

1. Dive into the Starr pit for the Medusa finale, facing the star as she emerges.
2. Thread through the Arch, where it meets the south wall.
3. Spiral around the burning Flame.
4. Pass up the Tree's trunk into its headwall, and skim the glass gym room's windows.
