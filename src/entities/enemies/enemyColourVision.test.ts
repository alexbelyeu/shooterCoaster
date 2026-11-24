import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { BiomeType, EnemyType } from '@/types/level'
import { ENEMY_PLACEMENT } from '@/entities/spawning/enemyPlacement'
import { ATMOSPHERES } from '@/levels/environments/atmosphere'
import type { ColorRamp } from '@/levels/environments/shared/types'
import { COLOR_RAMP as THEME_PARK_RAMP } from '@/levels/environments/biomes/themePark/config'
import { COLOR_RAMP as DESERT_RAMP } from '@/levels/environments/biomes/desert/config'
import { COLOR_RAMP as OCEAN_RAMP } from '@/levels/environments/biomes/ocean/config'
import { COLOR_RAMP as ARCTIC_RAMP } from '@/levels/environments/biomes/arctic/config'
import { COLOR_RAMP as VOLCANIC_RAMP } from '@/levels/environments/biomes/volcanic/config'
import { COLOR_RAMP as GYM_RAMP, WALL_PAINT } from '@/levels/environments/biomes/gym/config'
import { COLOR_RAMP as CITY_RAMP } from '@/levels/environments/biomes/city/config'
import { COLOR_RAMP as JUNGLE_RAMP } from '@/levels/environments/biomes/jungle/config'
import { WATER_COLOURS } from '@/levels/environments/shared/waterSurface'
import * as A from './SharedEnemyAssets'
import * as P from './enemyPalette'
import type { RimUniforms } from './enemyRim'
import { MIN_DELTA_E, MIN_DELTA_E_PROTAN, bestContrast, deltaE, glowColour, type Vision } from './colourVision'

// Colour-blind safety of the enemies' palettes (#838): each enemy against what it is seen against, each gym target
// against the climbers beside it and the golden balloon against the plain ones, under deuteranopia (held to
// `MIN_DELTA_E`) and protanopia (`MIN_DELTA_E_PROTAN`). Material colours, read from the shared assets themselves, so a
// repaint is checked the moment it lands; the allowance for lighting is in the threshold (colourVision.ts).

type Paint = string | number | THREE.Color | THREE.Material
const hex = (c: Paint): number => {
  if (typeof c === 'number') return c
  if (typeof c === 'string') return new THREE.Color(c).getHex()
  if (c instanceof THREE.Color) return c.getHex()
  const m = c as THREE.MeshPhongMaterial
  return m.emissive && m.emissiveIntensity > 0 ? glowColour(m.color.getHex(), m.emissive.getHex(), m.emissiveIntensity) : m.color.getHex()
}

/**
 * The rim's silhouette band: the colour where the surface turns half away from the eye (N·V = 0.5, the outer
 * quarter of a sphere's disc), `colour + rim × intensity × 0.5^power` (enemyRim.ts). It is what picks an enemy out
 * of a backdrop as dark as itself.
 */
function rimBand(colour: number, mat: THREE.Material): number[] {
  const rim = mat.userData.rim as RimUniforms | undefined
  if (!rim) return []
  return [glowColour(colour, rim.uRimColor.value.getHex(), rim.uRimIntensity.value * 0.5 ** rim.uRimPower.value)]
}

/** An enemy as the player reads it: the colours that cover a real part of its silhouette, and their rim bands. */
interface Read { id: string; type: EnemyType; biome: BiomeType; reads: number[] }
function enemy(id: string, type: EnemyType, biome: BiomeType, rim: THREE.Material | null, ...paints: Paint[]): Read {
  const reads: number[] = []
  for (const p of paints) {
    const c = hex(p)
    reads.push(c)
    const from = rim ?? (p instanceof THREE.Material ? p : null)
    if (from) reads.push(...rimBand(c, from))
  }
  return { id, type, biome, reads }
}

/**
 * The Ember Wisp has no paint, only glow: its core's emissive ramp at the cool flank (heat 0: ember × 0.8) and the
 * body (heat 0.5: flame × 1.2), with its rim, and the additive ribbons' root (× 1.15) and tip (infernoEnemyAssets.ts).
 */
const emberWisp = (): Read => {
  const core = enemy('emberWisp', 'emberWisp', 'volcanic', A.EMBER_WISP_CORE_MAT,
    glowColour(0, hex(P.WISP_EMBER), 0.8), glowColour(0, hex(P.WISP_FLAME), 1.2))
  core.reads.push(glowColour(0, hex(P.WISP_RIBBON_ROOT), 1.15), hex(P.WISP_RIBBON_TIP))
  return core
}

const ENEMIES: Read[] = [
  ...P.BALLOON_COLORS.map((c, i) => enemy(`balloon ${c}`, 'balloon', 'themePark', A.BALLOON_BODY_MATS[i], c)),
  enemy('goldenBalloon', 'balloon', 'themePark', null, A.GOLDEN_BODY_MAT),
  enemy('crow', 'crow', 'desert', A.CROW_FEATHER_MAT, P.CROW_BODY, P.CROW_SHEEN),
  enemy('toucan', 'toucan', 'jungle', A.CROW_FEATHER_MAT, P.TOUCAN_BODY, P.TOUCAN_BIB, P.TOUCAN_BILL),
  enemy('scorpion', 'scorpion', 'desert', A.SCORPION_SHELL_MAT, P.SCORPION_BODY_COLOR, P.SCORPION_PINCER_COLOR, P.SCORPION_LEG_COLOR),
  ...P.JELLY_COLORS.map((c, i) => enemy(`jellyfish ${c}`, 'jellyfish', 'ocean', null, A.JELLY_BODY_MATS[i], A.JELLY_INNER_MATS[i])),
  enemy('shark', 'shark', 'ocean', A.SHARK_MAT, P.SHARK_TOP, P.SHARK_BELLY),
  enemy('flyingFish', 'flyingFish', 'ocean', A.FFISH_MAT, P.FFISH_BODY, P.FFISH_BELLY, A.FFISH_WING_MAT),
  enemy('snowman', 'snowman', 'arctic', null, A.SNOWMAN_MAT, A.SNOWMAN_ARM_MAT, A.SNOWMAN_NOSE_MAT, A.SNOWMAN_COAL_MAT),
  enemy('snowmanBrute', 'snowmanBrute', 'arctic', null, A.SNOWMAN_MAT, A.SNOWMAN_SCARF_MAT, A.SNOWMAN_HAT_MAT, A.SNOWMAN_COAL_MAT),
  enemy('snowmanScout', 'snowmanScout', 'arctic', null, A.SNOWMAN_SCOUT_MAT, A.SNOWMAN_SCOUT_SHARD_MAT, A.SNOWMAN_NOSE_MAT, A.SNOWMAN_COAL_MAT),
  emberWisp(),
  enemy('fireImp', 'fireImp', 'volcanic', A.FIRE_IMP_MAT, P.IMP_ORANGE, P.IMP_DARK),
  enemy('lavaGolem', 'lavaGolem', 'volcanic', A.LAVA_GOLEM_MAT, ...P.OBSIDIAN, P.LAVA, P.LAVA_HOT),
  enemy('infernalDrake', 'infernalDrake', 'volcanic', A.DRAKE_MAT, P.DRAKE_CHARCOAL, P.DRAKE_MEMBRANE, P.DRAKE_GLOW),
  enemy('rat', 'rat', 'gym', A.RAT_MAT, P.RAT_FUR, P.RAT_BELLY),
  enemy('dustBunny', 'dustBunny', 'gym', A.DUST_BUNNY_MAT, P.DUST_GREY, P.DUST_CHALK),
  enemy('lanternfly', 'lanternfly', 'gym', A.LANTERNFLY_MAT, P.LANTERNFLY_FOREWING, P.LANTERNFLY_RED, P.LANTERNFLY_BODY),
  enemy('hoverDrone', 'hoverDrone', 'city', A.DRONE_MAT, P.DRONE_BODY, P.DRONE_DOME, glowColour(0, hex(P.DRONE_GLOW), 1.8)),
]

const RAMPS: Record<BiomeType, ColorRamp> = {
  themePark: THEME_PARK_RAMP, desert: DESERT_RAMP, ocean: OCEAN_RAMP,
  arctic: ARCTIC_RAMP, volcanic: VOLCANIC_RAMP, gym: GYM_RAMP, city: CITY_RAMP, jungle: JUNGLE_RAMP,
}

/**
 * What an enemy is seen against, by where it lives (`ENEMY_PLACEMENT`): the sky (zenith, and the horizon, which is
 * the fog) always; the terrain ramp and cliffs for air and ground enemies; the sea for sea enemies (they float in a
 * band of open water, not over the islands); the hall's floor and painted walls for everything in the gym.
 */
function backdrop(e: Read): { name: string; colour: number }[] {
  const { sky } = ATMOSPHERES[e.biome]
  const out = [{ name: 'zenith', colour: sky.zenith }, { name: 'horizon', colour: sky.horizon }]
  if (ENEMY_PLACEMENT[e.type].surface === 'water') {
    for (const [name, c] of Object.entries(WATER_COLOURS)) out.push({ name: `water ${name}`, colour: c })
    return out
  }
  RAMPS[e.biome].stops.forEach((s, i) => out.push({ name: `ground ${i}`, colour: s.color.getHex() }))
  out.push({ name: 'cliff', colour: RAMPS[e.biome].cliffColor.getHex() })
  if (e.biome === 'gym') for (const [wall, paints] of Object.entries(WALL_PAINT)) paints.forEach((p) => out.push({ name: wall, colour: hex(p) }))
  return out
}

/** The worst pair of an enemy against its backdrop under `vision`. */
function worstAgainstBackdrop(e: Read, vision: Vision) {
  let worst = { against: '', d: Infinity }
  for (const b of backdrop(e)) {
    const d = bestContrast(e.reads, b.colour, vision)
    if (d < worst.d) worst = { against: b.name, d }
  }
  return worst
}

const fmt = (c: number) => `#${c.toString(16).padStart(6, '0')}`

function failures(vision: Vision, min: number): string[] {
  const out: string[] = []
  for (const e of ENEMIES) {
    const w = worstAgainstBackdrop(e, vision)
    if (w.d < min) out.push(`${e.id} vs ${e.biome} ${w.against}: ${w.d.toFixed(3)}`)
  }
  // Golden balloon vs every plain balloon: the bonus target has to stand out from the crowd it hides in.
  const golden = hex(A.GOLDEN_BODY_MAT)
  for (const c of P.BALLOON_COLORS) {
    const d = deltaE(golden, hex(c), vision)
    if (d < min) out.push(`goldenBalloon vs balloon ${c}: ${d.toFixed(3)}`)
  }
  // Each gym target's body vs the climbers' main colours (shirt and trousers: most of a climber), pairwise.
  const climber = { shirt: hex(P.CLIMBER_SHIRT), trousers: hex(P.CLIMBER_TROUSERS) }
  const targets = { rat: hex(P.RAT_FUR), dustBunny: hex(P.DUST_GREY), lanternfly: hex(P.LANTERNFLY_FOREWING) }
  for (const [t, tc] of Object.entries(targets)) {
    for (const [part, bc] of Object.entries(climber)) {
      const d = deltaE(tc, bc, vision)
      if (d < min) out.push(`${t} ${fmt(tc)} vs climber ${part} ${fmt(bc)}: ${d.toFixed(3)}`)
    }
  }
  return out
}

describe('enemy palettes under colour-vision deficiency (#838)', () => {
  it('checks every enemy type (a new one adds its read colours to enemyPalette.ts and to ENEMIES here)', () => {
    const checked = new Set(ENEMIES.map((e) => e.type))
    // The climber is a bystander: it is checked against the gym targets beside it, not against the backdrop.
    const missing = (Object.keys(ENEMY_PLACEMENT) as EnemyType[]).filter((t) => t !== 'climber' && !checked.has(t))
    expect(missing).toEqual([])
  })

  it(`every pair keeps ΔE_OK ≥ ${MIN_DELTA_E} under deuteranopia`, () => {
    expect(failures('deuteranopia', MIN_DELTA_E)).toEqual([])
  })

  it(`every pair keeps ΔE_OK ≥ ${MIN_DELTA_E_PROTAN} under protanopia`, () => {
    expect(failures('protanopia', MIN_DELTA_E_PROTAN)).toEqual([])
  })

  it('and in normal vision', () => {
    expect(failures('normal', MIN_DELTA_E)).toEqual([])
  })
})
