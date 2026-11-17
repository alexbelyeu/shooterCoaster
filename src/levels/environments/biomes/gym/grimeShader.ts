import * as THREE from 'three'
import { valueNoiseGlsl } from '../../shared/noiseGlsl'
import { GYM_SCALE, HALL, PIT } from './blockout'
import { FIRE_LIGHT, GRIME, STRIP_LIGHTS, stripLightXs, stripLightY } from './config'
import { FLAME_TOP, fireLightSource } from './flameFire'

/**
 * The hall's grime and light (#593, "spectacularly Bushwick"), patched into the hall's, the floor's and the
 * holds' materials: blotchy grime, drips down the walls, dark boot grime along every wall's foot, chalk smudges
 * at hand height, the roof's half of the hall falling into shadow, and a warm pool under each strip-light
 * fixture (`STRIP_LIGHTS`), so the light falls in pools with darker corners between them rather than a flat fill;
 * and the Flame's fire (#599): its flickering light on everything round it (`FIRE_LIGHT`, the shared `FIRE_FLICKER`
 * uniform `FlameFire` sets each frame) and soot over its top.
 * Worked in blockout metres from world position; every term is bounded, so the output stays finite (#344).
 */

const f = (n: number) => n.toFixed(4)
/** The strip-light rows' spacing: they are evenly spaced (`config.test.ts`), so the nearest row is a snap. */
const ROW_GAP = STRIP_LIGHTS.rows[1] - STRIP_LIGHTS.rows[0]
const glslColor = (hex: string) => {
  const c = new THREE.Color(hex)
  return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`
}

const fire = fireLightSource()
const fireCos = Math.cos((fire.rot * Math.PI) / 180)
const fireSin = Math.sin((fire.rot * Math.PI) / 180)

/** The fire light's level, 0.5..1 (`fireFlicker`): one uniform shared by every patched material, set by `FlameFire` each frame. */
export const FIRE_FLICKER = { value: 1 }

const vertexHead = /* glsl */ `
varying vec3 vGrimePos;
`

const vertexBody = /* glsl */ `
{
  vec4 grimeWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  grimeWorld = instanceMatrix * grimeWorld;
  #endif
  grimeWorld = modelMatrix * grimeWorld;
  vGrimePos = vec3(grimeWorld.x / ${f(GYM_SCALE)} + ${f(HALL.w / 2)}, grimeWorld.y / ${f(GYM_SCALE)}, grimeWorld.z / ${f(GYM_SCALE)} + ${f(HALL.d / 2)});
}
`

const fragmentHead = /* glsl */ `
varying vec3 vGrimePos;
uniform float uFireFlicker;
${valueNoiseGlsl}
// A hall point in the Flame's own frame: along its length, up, across it
vec3 fireLocal(vec3 p) {
  vec2 d = p.xz - vec2(${f(fire.x)}, ${f(fire.z)});
  return vec3(d.x * ${f(fireCos)} - d.y * ${f(fireSin)}, p.y, d.x * ${f(fireSin)} + d.y * ${f(fireCos)});
}
float grimeFbm(vec2 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.13 + 5.7) + 0.15 * vnoise(p * 4.37 + 11.3);
}
`

/** Height (m) above the floor under a point: the main floor at 0, the pit's below it. */
const heightAboveFloor = /* glsl */ `
  float inPit = step(${f(PIT.minX)}, vGrimePos.x) * step(vGrimePos.x, ${f(PIT.maxX)}) * step(${f(PIT.minZ)}, vGrimePos.z) * step(vGrimePos.z, ${f(PIT.maxZ)});
  float grimeH = vGrimePos.y - inPit * ${f(PIT.floorY)};
`

/** Faces' orientation in the world from the view-space `normal` three has just worked out. */
const orientation = /* glsl */ `
  float upness = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
  float facesX = abs(dot(normal, normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz)));
  float vertical = 1.0 - smoothstep(0.5, 0.8, abs(upness));
  vec2 grimeUv = mix(vGrimePos.xz, facesX > 0.7 ? vGrimePos.zy : vGrimePos.xy, step(0.5, vertical));
`

const hallFragment = /* glsl */ `
{
  ${heightAboveFloor}
  ${orientation}
  float blotch = smoothstep(0.42, 0.82, grimeFbm(grimeUv * 0.3));
  float drips = smoothstep(0.5, 0.78, vnoise(vec2(grimeUv.x * 2.6, grimeUv.y * 0.09)) * (0.6 + 0.6 * vnoise(grimeUv * 0.4 + 3.1))) * vertical;
  float foot = (1.0 - smoothstep(0.0, ${f(GRIME.footHeight)}, grimeH)) * vertical;
  float chalk = smoothstep(0.64, 0.82, vnoise(grimeUv * 1.4 + 7.0)) * smoothstep(0.8, 1.6, grimeH) * (1.0 - smoothstep(5.0, 9.0, grimeH)) * vertical;
  float floorStain = smoothstep(0.45, 0.85, grimeFbm(vGrimePos.xz * 0.5 + 21.0)) * smoothstep(0.7, 0.95, upness);
  vec3 c = diffuseColor.rgb * (1.0 - ${f(GRIME.blotch)} * blotch - ${f(GRIME.drips)} * drips - ${f(GRIME.foot)} * foot - ${f(GRIME.floorStain)} * floorStain);
  c = mix(c, ${glslColor(GRIME.chalk)}, ${f(GRIME.chalkSmudge)} * chalk);
  // Soot over the Flame's top, patchy, thickest where the fire licks over its lip
  vec3 flameLocal = fireLocal(vGrimePos);
  float onFlame = (1.0 - smoothstep(${f(FLAME_TOP.halfLength)}, ${f(FLAME_TOP.halfLength + 0.6)}, abs(flameLocal.x))) * (1.0 - smoothstep(${f(FLAME_TOP.halfWidth)}, ${f(FLAME_TOP.halfWidth + 0.6)}, abs(flameLocal.z)));
  float soot = onFlame * smoothstep(${f(FLAME_TOP.y * 0.35)}, ${f(FLAME_TOP.y * 0.9)}, vGrimePos.y) * (0.45 + 0.55 * grimeFbm(grimeUv * 0.9 + 13.0));
  c = mix(c, ${glslColor(FIRE_LIGHT.soot)}, ${f(FIRE_LIGHT.sootAmount)} * soot);
  c *= mix(1.0, ${f(GRIME.roofShade)}, smoothstep(${f(HALL.h * 0.4)}, ${f(HALL.h * 0.95)}, vGrimePos.y));
  diffuseColor.rgb = c;
}
`

/** The nearest strip-light fixture's warm pool, lit like a downlight with some spill up onto the roof: falls off with distance, only on faces turned to it. */
const poolFragment = /* glsl */ `
{
  float lampX = clamp(vGrimePos.x, ${f(stripLightXs[0])}, ${f(stripLightXs[stripLightXs.length - 1])});
  lampX = floor(lampX / ${f(STRIP_LIGHTS.spacing)} + 0.5) * ${f(STRIP_LIGHTS.spacing)};
  lampX += clamp(vGrimePos.x - lampX, ${f(-STRIP_LIGHTS.length / 2)}, ${f(STRIP_LIGHTS.length / 2)});
  float lampZ = clamp(floor((vGrimePos.z - ${f(STRIP_LIGHTS.rows[0])}) / ${f(ROW_GAP)} + 0.5) * ${f(ROW_GAP)} + ${f(STRIP_LIGHTS.rows[0])}, ${f(STRIP_LIGHTS.rows[0])}, ${f(STRIP_LIGHTS.rows[STRIP_LIGHTS.rows.length - 1])});
  vec3 toLamp = vec3(lampX, ${f(stripLightY)}, lampZ) - vGrimePos;
  float dist = max(length(toLamp), 0.5);
  vec3 dir = toLamp / dist;
  float facing = max(dot(normal, normalize((viewMatrix * vec4(dir, 0.0)).xyz)), 0.0);
  float cone = smoothstep(0.35, 0.85, dir.y) + ${f(STRIP_LIGHTS.uplight)} * smoothstep(0.2, 0.8, -dir.y);
  float pool = ${f(STRIP_LIGHTS.pool)} * facing * cone / (1.0 + dist * dist / ${f(STRIP_LIGHTS.reach * STRIP_LIGHTS.reach)});
  reflectedLight.directDiffuse += diffuseColor.rgb * ${glslColor(STRIP_LIGHTS.color)} * pool;
}
`

/** The fire's flickering light from the nearest point of its source; within its shell the flames are on the surface, lighting it whichever way it faces. */
const fireFragment = /* glsl */ `
{
  vec3 local = fireLocal(vGrimePos);
  vec3 toFire = vec3(clamp(local.x, ${f(-fire.halfLength)}, ${f(fire.halfLength)}), clamp(local.y, ${f(fire.minY)}, ${f(fire.maxY)}), 0.0) - local;
  float dist = max(length(toFire), 0.5);
  vec3 dir = toFire / dist;
  dir = vec3(dir.x * ${f(fireCos)} + dir.z * ${f(fireSin)}, dir.y, -dir.x * ${f(fireSin)} + dir.z * ${f(fireCos)});
  float facing = max(dot(normal, normalize((viewMatrix * vec4(dir, 0.0)).xyz)), 0.0);
  facing = mix(1.0, facing, smoothstep(${f(FIRE_LIGHT.shell)}, ${f(FIRE_LIGHT.shell + 2)}, dist));
  float fireLight = ${f(FIRE_LIGHT.strength)} * clamp(uFireFlicker, 0.0, 1.5) * facing / (1.0 + dist * dist / ${f(FIRE_LIGHT.reach * FIRE_LIGHT.reach)});
  reflectedLight.directDiffuse += diffuseColor.rgb * ${glslColor(FIRE_LIGHT.color)} * fireLight;
}
`

/** Holds: chalk caked on their tops, where hands go, patchy. */
const holdFragment = /* glsl */ `
{
  ${orientation}
  float caked = smoothstep(0.0, 0.7, upness) * smoothstep(0.3, 0.7, vnoise(vGrimePos.xy * 9.0 + vGrimePos.zz * 5.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColor(GRIME.chalk)}, ${f(GRIME.holdChalk)} * caked);
}
`

const inject = (source: string, chunk: string, extra: string) => source.replace(chunk, `${chunk}\n${extra}`)

function patch(material: THREE.Material, key: string, surface: string, pool: boolean): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = inject(shader.vertexShader, '#include <common>', vertexHead)
    shader.vertexShader = inject(shader.vertexShader, '#include <begin_vertex>', vertexBody)
    shader.fragmentShader = inject(shader.fragmentShader, '#include <common>', fragmentHead)
    shader.fragmentShader = inject(shader.fragmentShader, '#include <normal_fragment_maps>', surface)
    if (pool) shader.fragmentShader = inject(shader.fragmentShader, '#include <lights_fragment_end>', `${poolFragment}\n${fireFragment}`)
    shader.uniforms.uFireFlicker = FIRE_FLICKER
  }
  material.customProgramCacheKey = () => key
}

/** The hall's painted solid: grime, drips, chalk, roof shade, the strip lights' pools. */
export function withHallGrime<M extends THREE.Material>(material: M): M {
  patch(material, 'gym-hall-grime', hallFragment, true)
  return material
}

/** The hall's concrete floor (the terrain): the same grime and pools, in flat-shaded Phong like every terrain. */
export function createGymFloorMaterial(): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 8 })
  patch(material, 'gym-floor-grime', hallFragment, true)
  return material
}

/** The holds: chalk on their tops, and the pools so a hold under a fixture catches its light like the wall it sits on. */
export function withHoldChalk<M extends THREE.Material>(material: M): M {
  patch(material, 'gym-hold-chalk', holdFragment, true)
  return material
}
