/** Every SFX goes through here: the arcade engine (`arcade/`), a lazy chunk loaded by the first `prepare`. */
import * as THREE from 'three'
import type { BiomeType } from '@/types/level'
import type { WeaponId } from '@/combat/weapons/weaponTypes'
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

/** `whoosh`: PLAY on the title, under its fade to black. */
export type UiSound = 'select' | 'back' | 'launch' | 'whoosh'

export interface SfxEngine {
  /** `level` null: the menus' sounds. */
  prepare(level: string | null, biome: BiomeType): Promise<void>
  fire(auto: boolean, weapon?: WeaponId): void
  pickup(): void
  hit(combo: number, at: Placement | null): void
  kill(combo: number, sound: KillSound, at: Placement | null): void
  bossPart(combo: number, partId: string, at: Placement | null): void
  comboBreak(): void
  frenzy(): void
  frenzyLift(on: boolean): void
  waveIncoming(): void
  bossArrival(): void
  bossHit(hpFraction: number): void
  bossDefeat(): void
  fireworkWhistle(flightS: number, timeScale: number): void
  fireworkPop(): void
  starChime(index: number): void
  ui(sound: UiSound): void
  countdown(go: boolean): void
  /** The ride wind from the coaster's speed (0–1), every frame; silent without a level's sounds. */
  wind(speed: number): void
  /** Long-lived nodes, the wind's included: must not grow while playing. */
  nodeCount(): number
  /** e2e: kills since load that reached the audio engine (not throttled, not refused a voice). */
  killsPlayed(): number
  voices(): VoiceStats | null
  /** With `level`: only if no menu has asked for its own sounds since. */
  dispose(level?: string): void
}

type ArcadeModule = typeof import('./arcade/engine')
let arcadeModule: Promise<ArcadeModule> | null = null

/** Loaded on first use, after the first gesture. */
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
  waveIncoming: silent, bossArrival: silent, bossHit: silent, bossDefeat: silent,
  fireworkWhistle: silent, fireworkPop: silent, starChime: silent, ui: silent, countdown: silent, wind: silent,
  nodeCount: () => 0,
  killsPlayed: () => 0,
  voices: () => null,
  dispose: silent,
}

/** Until the arcade chunk has loaded. */
const pendingArcade: SfxEngine = {
  ...silentSfx,
  prepare: (level, biome) => loadArcade().then((m) => m.arcadeSfx.prepare(level, biome)),
}

let active: SfxEngine = pendingArcade

export function sfx(): SfxEngine {
  return active
}

/** A failed bake drops the level's sounds, never the page; the promise never rejects. */
export function prepareSfx(level: string | null, biome: BiomeType): Promise<void> {
  return active.prepare(level, biome).catch((e) => dropSound('sfx prepare', e))
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
