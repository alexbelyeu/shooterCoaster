/** Every SFX goes through here: the Tone.js kit, or the arcade engine under `?audio=scrim` until parity (hard rule 7). */
import * as THREE from 'three'
import type { BiomeType } from '@/types/level'
import type { WeaponId } from '@/combat/weapons/weaponTypes'
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
  /** `level` null: the menus' sounds. */
  prepare(level: string | null, biome: BiomeType): Promise<void>
  /** `weapon`: the pickup gun's own shot (`combat/weapons/weaponTypes.ts`). */
  fire(auto: boolean, weapon?: WeaponId): void
  /** A weapon pickup was shot. */
  pickup(): void
  hit(combo: number, at: Placement | null): void
  kill(combo: number, sound: KillSound, at: Placement | null): void
  bossPart(combo: number, partId: string, at: Placement | null): void
  comboBreak(): void
  frenzy(): void
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
  /** Long-lived nodes: must not grow while playing. */
  nodeCount(): number
  voices(): VoiceStats | null
  /** With `level`: only if no menu has asked for its own sounds since. */
  dispose(level?: string): void
}

const toneSfx: SfxEngine = {
  prepare: (level, biome) => {
    if (level) tone.prepareLevelSFX(biome)
    return Promise.resolve()
  },
  fire: (auto, weapon) => tone.playFireSound(auto, weapon),
  pickup: tone.playPickupChime,
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

/** Loaded on first use, so default players never download it. */
export function loadArcade(): Promise<ArcadeModule> {
  arcadeModule ??= import('./arcade/engine').then((m) => {
    if (active === pendingArcade) active = m.arcadeSfx
    return m
  })
  return arcadeModule
}

const silent = () => {}
/** A mix render's music-only stem. */
export const silentSfx: SfxEngine = {
  prepare: () => Promise.resolve(),
  fire: silent, pickup: silent, hit: silent, kill: silent, bossPart: silent, comboBreak: silent, frenzy: silent, frenzyLift: silent,
  waveIncoming: silent, waveAnnounce: silent, bossArrival: silent, bossHit: silent, bossDefeat: silent,
  fireworkWhistle: silent, fireworkPop: silent, starChime: silent, ui: silent, countdown: silent,
  nodeCount: () => 0,
  voices: () => null,
  dispose: silent,
}

/** Until the arcade chunk has loaded. */
const pendingArcade: SfxEngine = {
  ...silentSfx,
  prepare: (level, biome) => loadArcade().then((m) => m.arcadeSfx.prepare(level, biome)),
}

let active: SfxEngine = MUSIC_ENGINE === 'scrim' ? pendingArcade : toneSfx

export function sfx(): SfxEngine {
  return active
}

/** `audioRender.ts`: a render's engine, whatever this page plays. */
export async function sfxEngine(engine: MusicEngine): Promise<SfxEngine> {
  return engine === 'scrim' ? (await loadArcade()).arcadeSfx : toneSfx
}

/** A failed bake drops the level's sounds, never the page. */
export function prepareSfx(level: string | null, biome: BiomeType): void {
  active.prepare(level, biome).catch((e) => dropSound('sfx prepare', e))
}

let listener: THREE.Camera | null = null
const _local = new THREE.Vector3()
const _placement: Placement = { pan: 0, cutoffHz: 20000 }

export function setSfxListener(camera: THREE.Camera | null): void {
  listener = camera
}

/** One shared object; null without a listener. */
export function placeSound(position: THREE.Vector3 | null | undefined): Placement | null {
  if (!position || !listener) return null
  _local.copy(position).applyMatrix4(listener.matrixWorldInverse)
  const persp = listener as THREE.PerspectiveCamera
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad((persp.fov ?? 60) / 2))
  return spatial(_local.x, _local.z, tanHalfV * (persp.aspect ?? 1), _placement)
}
