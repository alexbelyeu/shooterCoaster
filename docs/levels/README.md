# Level blockouts

`gym-blockout.json` is Alex's blockout of his real climbing gym (12 Nov 2026, #513), built
from the gym's Setter's Map and his photos. Level 6 is built from it: #514 moves it to
`src/levels/environments/biomes/gym/blockout.json` (keep it verbatim) and reads it with a
pure `blockout.ts`. Don't name the real gym anywhere: in the game it is "the Climbing Gym".

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
