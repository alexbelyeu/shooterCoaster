## 2026-10-31 — Which enemy parts reflect the sky env map (Builder, #139)

**Context:** The 2026-10-24 sky env map entry (#121) says "The crows are the exception"
among enemies picking up `scene.environment`. That was wrong: the level5 `fireImp`
(`FIRE_IMP_BODY_MAT`) and `infernalDrake` (`DRAKE_BODY_MAT`) bodies are
`MeshPhysicalMaterial` too, so they reflect the Inferno sky at its `envIntensity` 0.6.
Most other enemy bodies were `MeshPhongMaterial`, which ignores the env map, so glossy
parts read flat.
**Decision:** Glossy parts move to `MeshStandardMaterial` (in `SharedEnemyAssets.ts`): the
shark skin (body, snout, fins, belly), the scorpion shell and tail, and the snowmen's coal
eyes, mouth and buttons. Matte or soft parts stay Phong (balloons, jellyfish, flying
fish, snowman bodies, carrot, scarf and hat, wisps, golem, horns, spikes, wings). The full
list of enemy materials that reflect the sky: crow feathers, fire imp and drake bodies
(Physical); the parts above, golden balloons and knots, the scorpion stinger, the
jellyfish cores, every eye except the flying fish's, and every lit boss material (Standard).
**Consequences:** Moving a material between Phong and Standard changes how it looks in every
biome that uses it; Standard has no `specular` colour, so tune `metalness` / `roughness`
against the level's `envIntensity`. Each Standard fragment samples the env map, so keep
large or numerous enemies (Theme Park's ~150 balloons) on Phong unless the look needs it.
