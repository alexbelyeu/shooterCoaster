import type { BiomeType } from '@/types/level'
import type { HeroShot } from '@/track/introCamera.hot'
import { RIDES } from './biomes/themePark/parkSpec'
import { PYRAMID } from './biomes/desert/landmarks'
import { PYRAMID_HEIGHT } from './landmarkDimensions'
import { SUNKEN_CITY_POSITION } from './biomes/ocean/config'
import { FORTRESS_SITE } from './biomes/arctic/config'
import { VOLCANO, VOLCANO_SITE } from './volcanoGeometry'
import { GYM_SCALE, STAR, toWorld } from './biomes/gym/blockout'

const ferrisWheel = RIDES.filter((r) => r.kind === 'ferrisWheel').reduce((a, b) => (b.radius > a.radius ? b : a))
const star = toWorld(STAR.centre)

/** Each biome's hero landmark, which the countdown's swoop starts over and the results orbit circles (#328). */
export const HERO_SHOTS: Record<BiomeType, HeroShot> = {
  themePark: { x: ferrisWheel.x, z: ferrisWheel.z, focus: ferrisWheel.radius, orbitRadius: 380, orbitHeight: 220 },
  desert: { x: PYRAMID.x, z: PYRAMID.z, focus: PYRAMID_HEIGHT * 0.4, orbitRadius: 1300, orbitHeight: 520 },
  ocean: {
    x: SUNKEN_CITY_POSITION[0], z: SUNKEN_CITY_POSITION[2], ground: SUNKEN_CITY_POSITION[1],
    focus: 25, orbitRadius: 600, orbitHeight: 260,
  },
  arctic: { x: FORTRESS_SITE.x, z: FORTRESS_SITE.z, focus: 50, orbitRadius: 520, orbitHeight: 240 },
  volcanic: { x: VOLCANO_SITE.x, z: VOLCANO_SITE.z, focus: VOLCANO.height * 0.45, orbitRadius: 2300, orbitHeight: 1000 },
  // The Starr hangs on the hall's end wall: the orbit swings in front of it, inside the hall.
  gym: {
    x: star.x, z: star.z, ground: 0, focus: star.y, orbitRadius: 20 * GYM_SCALE, orbitHeight: 9 * GYM_SCALE,
    arc: 0.7, facing: Math.atan2(STAR.facing.z, STAR.facing.x),
  },
}
