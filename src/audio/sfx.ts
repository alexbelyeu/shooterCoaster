/**
 * The game's one way to play SFX: the Tone.js kit (`SFXManager`, default) or the arcade engine (`arcade/`, under
 * `?audio=scrim` with the score engine, loaded only then) until it reaches parity (hard rule 7). Positions are world
 * space; the listener is the coaster camera (`setSfxListener`).
 */
import * as THREE from 'three'
import type { BiomeType } from '@/types/level'
import * as tone from './SFXManager'
import { MUSIC_ENGINE, type MusicEngine } from './musicEngine'
import { dropSound } from './soundGuard'
import { spatial, type KillSound } from './sfxDesign'

export interface Placement {
  pan: number
  cutoffHz: number
}

export interface VoiceStats {
  budget: number
  live: number
  peak: number
  played: number
  stolen: number
  rejected: number
}

export type UiSound = 'select' | 'back' | 'launch'

export interface SfxEngine {
  /** Builds the level's sounds (`level` null: the menus'); resolves once they can play. */
  prepare(level: string | null, biome: BiomeType): Promise<void>
  fire(auto: boolean): void
  hit(combo: number, at: Placement | null): void
  kill(combo: number, sound: KillSound, at: Placement | null): void
  /** A boss weak point destroyed (`partId` from its spec). */
  bossPart(combo: number, partId: string, at: Placement | null): void
  comboBreak(): void
  frenzy(): void
  /** The looping FRENZY lift: on while the 5× tier holds in a running level. */
  frenzyLift(on: boolean): void
  waveIncoming(): void
  waveAnnounce(): void
  bossArrival(): void
  bossHit(hpFraction: number): void
  bossDefeat(): void
  fireworkWhistle(flightS: number, timeScale: number): void
  fireworkPop(): void
  starChime(index: number): void
  ui(sound: UiSound): void
  countdown(go: boolean): void
  /** Long-lived audio nodes; must not grow while playing. */
  nodeCount(): number
  voices(): VoiceStats | null
  /** Frees the sounds: all of them, or only if they are still `level`'s (a menu may have prepared its own since). */
  dispose(level?: string): void
}

const toneSfx: SfxEngine = {
  prepare: (level, biome) => {
    if (level) tone.prepareLevelSFX(biome)
    return Promise.resolve()
  },
  fire: (auto) => tone.playFireSound(auto),
  hit: () => tone.playHitTick(),
  kill: (combo, sound) => tone.playExplosionSound(combo, sound),
  bossPart: (combo) => tone.playExplosionSound(combo),
  comboBreak: tone.playComboBreak,
  frenzy: () => {},
  frenzyLift: () => {},
  waveIncoming: () => {},
  waveAnnounce: tone.playWaveStinger,
  bossArrival: tone.playBossStinger,
  bossHit: (hpFraction) => tone.playBossHit({ hpFraction }),
  bossDefeat: tone.playBossDefeat,
  fireworkWhistle: (flightS, timeScale) => tone.playFireworkWhistle({ flightS, timeScale }),
  fireworkPop: tone.playFireworkPop,
  starChime: tone.playStarChime,
  ui: () => {},
  countdown: () => {},
  nodeCount: tone.sfxNodeCount,
  voices: () => null,
  dispose: () => tone.disposeSFX(),
}

type ArcadeModule = typeof import('./arcade/engine')
let arcadeModule: Promise<ArcadeModule> | null = null

/** The arcade engine's module, loaded on first use so default players never download it. */
export function loadArcade(): Promise<ArcadeModule> {
  arcadeModule ??= import('./arcade/engine').then((m) => {
    if (active === pendingArcade) active = m.arcadeSfx
    return m
  })
  return arcadeModule
}

const silent = () => {}
/** Plays nothing: a mix render's music-only stem. */
export const silentSfx: SfxEngine = {
  prepare: () => Promise.resolve(),
  fire: silent, hit: silent, kill: silent, bossPart: silent, comboBreak: silent, frenzy: silent, frenzyLift: silent,
  waveIncoming: silent, waveAnnounce: silent, bossArrival: silent, bossHit: silent, bossDefeat: silent,
  fireworkWhistle: silent, fireworkPop: silent, starChime: silent, ui: silent, countdown: silent,
  nodeCount: () => 0,
  voices: () => null,
  dispose: silent,
}

/** Stands in for the arcade engine until its chunk has loaded: sounds before then are skipped. */
const pendingArcade: SfxEngine = {
  ...silentSfx,
  prepare: (level, biome) => loadArcade().then((m) => m.arcadeSfx.prepare(level, biome)),
}

let active: SfxEngine = MUSIC_ENGINE === 'scrim' ? pendingArcade : toneSfx

/** The SFX engine this page plays. */
export function sfx(): SfxEngine {
  return active
}

/** `audioRender.ts`: the engine a render asks for, whatever this page plays. */
export async function sfxEngine(engine: MusicEngine): Promise<SfxEngine> {
  return engine === 'scrim' ? (await loadArcade()).arcadeSfx : toneSfx
}

/** Fire-and-forget `prepare`: a failed bake drops the level's sounds, never the page. */
export function prepareSfx(level: string | null, biome: BiomeType): void {
  active.prepare(level, biome).catch((e) => dropSound('sfx prepare', e))
}

let listener: THREE.Camera | null = null
const _local = new THREE.Vector3()
const _placement: Placement = { pan: 0, cutoffHz: 20000 }

export function setSfxListener(camera: THREE.Camera | null): void {
  listener = camera
}

/** Pan and distance low-pass of a world position from the listener; one shared object, null without a listener. */
export function placeSound(position: THREE.Vector3 | null | undefined): Placement | null {
  if (!position || !listener) return null
  _local.copy(position).applyMatrix4(listener.matrixWorldInverse)
  const persp = listener as THREE.PerspectiveCamera
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad((persp.fov ?? 60) / 2))
  return spatial(_local.x, _local.z, tanHalfV * (persp.aspect ?? 1), _placement)
}
