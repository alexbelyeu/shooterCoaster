import { describe, expect, it } from 'vitest'
import { COMBO_TIERS, comboTierIndex } from '@/combat/comboTiers'
import {
  MAX_INTENSITY,
  intensityForTier,
  layerSounds,
  layerState,
  liftHz,
  nextLayerStep,
  recordLayerStep,
  resumeLayers,
  type LayerGrid,
} from './layers'
import { compile } from './score'

// 120 BPM in 4: a beat is 0.5 s, a bar 2 s; a one-bar intro.
const g: LayerGrid = { introS: 2, beatS: 0.5, barS: 2 }

describe('intensity layers', () => {
  it('stacks base, drums, lead and frenzy; untagged voices are base', () => {
    expect([0, 1, 2, 3].map((i) => layerSounds(undefined, i))).toEqual([true, true, true, true])
    expect([0, 1, 2, 3].map((i) => layerSounds('drums', i))).toEqual([false, true, true, true])
    expect([0, 1, 2, 3].map((i) => layerSounds('lead', i))).toEqual([false, false, true, true])
    expect([0, 1, 2, 3].map((i) => layerSounds('frenzy', i))).toEqual([false, false, false, true])
  })

  it('follows the combo tier: 1× base, 2× drums, 3× lead, 5× FRENZY', () => {
    expect(COMBO_TIERS.map((t) => intensityForTier(comboTierIndex(t.minCount)))).toEqual([0, 1, 2, MAX_INTENSITY])
    expect(intensityForTier(comboTierIndex(0))).toBe(0)
  })

  it('opens the low-pass only at FRENZY', () => {
    expect(liftHz(2)).toBeLessThan(liftHz(3))
    expect(liftHz(0)).toBe(liftHz(2))
  })

  it('holds still when already there', () => {
    expect(nextLayerStep(2, 0, 2, 7.3, g)).toBeNull()
  })

  it('goes straight to the target at the loop start during the intro', () => {
    expect(nextLayerStep(MAX_INTENSITY, 0, 0, 0.4, g)).toEqual({ intensity: 0, at: 2 })
    expect(nextLayerStep(MAX_INTENSITY, 0, 0, -0.1, g)).toEqual({ intensity: 0, at: 2 })
  })

  it('rises on the next beat line, leaving the ramp its time', () => {
    expect(nextLayerStep(0, 2, 3, 7.3, g)).toEqual({ intensity: 3, at: 7.5 })
    expect(nextLayerStep(0, 2, 1, 7.47, g)).toEqual({ intensity: 1, at: 8 })
    expect(nextLayerStep(0, 2, 1, 7.4, g)).toEqual({ intensity: 1, at: 7.5 })
  })

  it('falls one layer on the next beat, then one a bar after each change', () => {
    const first = nextLayerStep(3, 2, 0, 9.1, g)
    expect(first).toEqual({ intensity: 2, at: 9.5 })
    expect(nextLayerStep(2, first!.at, 0, 9.12, g)).toBeNull()
    const second = nextLayerStep(2, first!.at, 0, 9.52, g)
    expect(second).toEqual({ intensity: 1, at: 11.5 })
    expect(nextLayerStep(1, second!.at, 0, 13.47, g)).toEqual({ intensity: 0, at: 14 })
    expect(nextLayerStep(1, second!.at, 0, 11.6, g)).toEqual({ intensity: 0, at: 13.5 })
  })

  it('a rise cuts a wind-down short', () => {
    expect(nextLayerStep(1, 11.5, 3, 10.2, g)).toEqual({ intensity: 3, at: 10.5 })
  })

  it('a pause in the intro resumes on the full band and still drops to the run at the loop start', () => {
    const s = layerState(MAX_INTENSITY)
    recordLayerStep(s, nextLayerStep(s.intensity, s.at, 0, 0.3, g)!, 0.3)
    expect(resumeLayers(s, 1.2)).toEqual({ open: MAX_INTENSITY, pending: { intensity: 0, at: 2 } })
    expect(resumeLayers(s, 2.4)).toEqual({ open: 0, pending: null })
  })

  it('a step scheduled before a pause still lands on its beat after it', () => {
    const s = layerState(0)
    recordLayerStep(s, { intensity: 1, at: 6 }, 5)
    expect(resumeLayers(s, 6)).toEqual({ open: 1, pending: null })
    recordLayerStep(s, { intensity: 3, at: 7.5 }, 7.3)
    expect(resumeLayers(s, 7.4)).toEqual({ open: 1, pending: { intensity: 3, at: 7.5 } })
  })

  it('a rise over a step that has not landed keeps what is still playing', () => {
    const s = layerState(1)
    recordLayerStep(s, { intensity: 2, at: 8 }, 7.6)
    recordLayerStep(s, { intensity: 3, at: 8 }, 7.8)
    expect(resumeLayers(s, 7.9)).toEqual({ open: 1, pending: { intensity: 3, at: 8 } })
  })
})

describe('layer= on a voice', () => {
  it('tags the voice; untagged voices carry no layer, as the original compiles them', () => {
    const song = compile('steps 2\nvoice a flute layer=lead\nvoice b kick\npattern A\na | C4------- |\nb | x....... |\nloop A')
    expect(song.errors).toEqual([])
    expect(song.voices.map((v) => v.layer)).toEqual(['lead', undefined])
    expect('layer' in song.voices[1]).toBe(false)
  })

  it('names the layers on a bad one', () => {
    const song = compile('steps 2\nvoice a flute layer=solo\npattern A\na | C4------- |\nloop A')
    expect(song.errors).toEqual([{ line: 2, msg: 'layer= is one of base, drums, lead, frenzy; got "solo".' }])
  })
})
