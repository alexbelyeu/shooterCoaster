# Enemy art briefs

_Epic #381 (Alex, 5 Nov 2026: "from primitives to characters"), step 2. Owned by the
Director; one brief per enemy and boss. Builders upgrade one enemy (or one set) per issue,
worst first, and attach the turntable sheet before and after (`npm run turntable -- --only
<id>`). Linked from VISION.md._

## The one style

A **stylised low-poly diorama**: everything looks like a well-made toy on a model
railway. Smooth faceted volumes with a few deliberate bevels, tapered limbs, oversized
heads and hands where there are any, two-dot eyes or one glint, gradient vertex colours
(darker underneath, a lighter "sun" side), no textures, no outlines. Friendly even when
menacing: a shark is a toy shark. Every enemy keeps VISION's **readability colour** against
its level's terrain and sky, reads as its silhouette at **12 px** (the smoke's probe) and as a
character at the turntable's **4× close-up**.

Every enemy has a **motion set**: idle, move cycle, hit reaction (~120 ms, before the flash
and pop), death (its `deathStyles.ts` style). Cycles run on game time (`core/gameClock.ts`),
so a pause freezes them. **Budget** per enemy: never more draw calls than today (one per
material and moving part, `placedParts`, #260), the triangle cap below, and the level stays
inside `budgets.json` with its heaviest wave on screen.

## Briefs

| Enemy (level) | Silhouette / personality | Palette (readability colour first) | 12 px | 4× close-up | Motion set | Tri cap | State (Nov 9) |
|---|---|---|---|---|---|---|---|
| **Balloon** (1) | A fat party balloon with a curly string, bobbing | any bright primary; string white | a bright disc | highlight, knot, curled string | bob; hit: squash; death: confetti | 300 | holds up |
| **Golden balloon** (1) | The same, gold with a glint | gold #f2b32a, glint white | gold disc | metallic gradient, star glint | as balloon; death: gold confetti (#335) | 300 | holds up |
| **Crow** (2) | A scrappy desert raven mid-flap, leaning into the dive | body #15131a, wing sheen #3a2a55 → black, beak + feet #e8862a, eye #ffd166 | black wedge + two wings, flap reads | hooked beak, tail fan, wing segments, eye glint | hover flap; dive flap + bank; hit: wings snap up; death: feathers | 600 | **worst: #462** |
| **Scorpion** (2) | Low, wide, tail curled high, claws forward | dark #2a1a10 on gold sand, tail tip red | dark wide blob with a raised hook | segmented tail, pincers, eight legs | scuttle (legs alternate); hit: tail flick; death: shards | 700 | holds up |
| **Jellyfish** (3) | A glowing bell trailing tentacles, pulsing | bell #7fe0ff translucent-glow, tentacles paler | glowing dome | bell ribs, tentacle wave | pulse + drift; hit: flash white; death: splash | 500 | holds up |
| **Shark** (3) | A toy shark: long nose, big dorsal, grin | top #3a5f7a, white belly, red gums | a fin + a white belly flash | gills, teeth, eye | tail sweep swim, roll on turns; hit: flinch; death: splash | 700 | weak head-on (next pass) |
| **Flying fish** (3) | A silver dart with wing-fins out | silver #cfd8e0, cyan fin edge | silver streak | scales gradient, fin membrane | glide + skip; hit: flip; death: splash | 400 | ok |
| **Snowman scout / snowman / brute** (4) | Three sizes of the same snow family: scout thin and quick, snowman classic, brute a boulder with arms | snow white, **navy scarf** #1f2a6b, coal, carrot | white stack with a dark scarf band | buttons, twig arms, hat, grin | waddle (scout quick hop); hit: wobble; death: snowballs | 500 / 600 / 900 | hold up |
| **Ember wisp** (5) | A drifting flame spirit, teardrop core, ribbon tail | core white → #ff8a2a → #a01010 emissive, coal eyes | glowing teardrop with a tail | ribbon flames lag the motion | figure-eight drift; hit: core blinks white; death: embers | 500 | **weak: #463** |
| **Fire imp** (5) | Stocky grinning gremlin: pear body, big head, horns, whip tail | orange #ff7a1a → dark underneath, yellow eyes, dark mouth | orange blob with horns | fangs, horns, pumping arms | hop with squash/stretch; hit: arms up; death: embers | 700 | **weak: #463** |
| **Lava golem** (5) | A hulking cracked-rock brute **with legs**, head set low | obsidian #141014, emissive lava cracks #ff5a1a pulsing | dark block with glowing seams | boulder shoulders, swinging arms | heavy two-step walk; hit: seams flare; death: lava chunks | 900 | **weak: #463** |
| **Infernal drake** (5) | A long-necked dragon, bat wings, spade tail | charcoal #2a1e1e, wing membrane #8a1a1a glow edges | a cross of wings and neck | horns, membrane veins, eye glow | wing beat + neck sway; hit: roar flinch; death: embers | 900 | weak (after #463) |
| **Climber** (6, #453; a **bystander** from #518) | A toy climber figurine: smooth limbs, oversized helmet, chalk bag, harness, a rope up to the top. **Not a target**: shooting one costs points and the combo | **friendly**, never an enemy colour: calm teal shirt, white helmet and trousers, a green harness and an unlit green chevron (the friend marker) bobbing over the helmet; nothing in the gym's pests' greys, browns or ambers, and the chevron reads at a few px on any wall | a teal figure on a rope, clearly not a pest | helmet vents, chalk bag, quickdraw clip | climb cycle (reach / pull / rest), clip pause, topping out; hit: chalk puff, gone (no kill pop) | 700 (+ the 4-triangle marker) | built (#453); friendly look and the penalty built (#518) |
| **New York rat** (6, #515) | A cartoon city rat scurrying in bursts: long body, long pink tail, big round pink ears, pointy nose, whiskers | grey-brown #6b6058 body, lighter belly, pink #f2a0a8 ears / nose / tail, black bead eyes | a low grey dash with a tail | whiskers, ears, little hands | scurry (quick stops, nose twitch, tail swish), runs along wall bases and over mats and boulders; hit: jumps; death: a toy puff with grey fluff bits | 600 | built (#515) |
| **Dust bunny** (6, #515) | A fluffy ball of dust and chalk, two dot eyes, a few stray hairs and a lost hold-tape scrap | dusty grey #9a968e with white chalk flecks; eyes black with a glint | a soft grey ball | faceted fluff tufts, the eyes, stray threads | roll and drift low, bob, squash on bumps; hit: puffs up; death: dust and chalk puff | 500 | built (#515) |
| **Spotted lanternfly** (6, #516) | *Lycorma delicatula*: a moth-like bug in a wedge at rest; opens to flash red hindwings when it hops | forewings beige-grey #c9b8a0 with black spots and a speckled tip; hindwings red #d8282a with black spots and a white band; black body | a spotted wedge on a wall; a red flash on each hop | wing spots, the white band, antennae | crawl, hop and glide to a new spot (wings open red), swarm on walls and the Tree; hit: wings flare; death: spotted flakes + red flash | 500 | #516 |

### Bosses (step 5, after the enemy style is set)

| Boss | Brief |
|---|---|
| **Golden Blimp** (1) | A brass-and-gold airship with a gondola, towing five golden balloons; bunting, a propeller that spins. Seen large: panel lines as colour bands, a glint sweep. |
| **Kraken** (3) | Thicker, darker tentacles (deep teal #184a5a) with bright sucker pads (#ffb3a0), a bigger head with one huge eye; a splash that reaches the camera. (Backlog "Kraken presence pass".) |
| **Giant Scorpion** (2) | The scorpion brief at 10×: plated segments with sand-dust gradients, glowing stinger. |
| **Yeti** (4) | Shaggy white fur as layered faceted tufts, blue face and palms, a roar pose with the chest exposed. |
| **Medusa of the Starr** (6, #521) | Modelled, with her blessing, on a real person: brown skin, a big nose with a **jewel piercing on the bridge**, curly dark hair; kind eyes with a mischievous look. A big bust rising out of the yellow / black star; snakes (the weak points) grow from her curls, sway, rear and strike at the camera. Affectionate and flattering, toy-like, never grotesque: she is the gym's queen. |
| **Magma Titan** (5, #320) | A golem brief at 10×: a cathedral of cracked obsidian with lava veins, eyes as crater glows. |

## How an upgrade issue is judged

1. Before / after turntable sheets in the PR (`<id>-angles.png`, `<id>-motion.png`).
2. The level's smoke shard: readability at the probe not lower, `scene` within budget.
3. Draw calls per enemy not above today's; triangles under the cap.
4. `ShaderWarmup` compiles the new materials (the shot step: first shot compiles nothing).
5. One style: if the new enemy would look out of place next to the climber and the crow, it
   isn't done.
