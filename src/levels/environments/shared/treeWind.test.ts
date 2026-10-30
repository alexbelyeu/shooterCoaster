import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakeCrownShade, CANOPY_PART, patchTreeFillFragment, patchTreeWindVertex, TRUNK_PART } from './treeWind'

describe('tree wind', () => {
  it('patches the Phong vertex shader at both anchors', () => {
    const src = THREE.ShaderLib.phong.vertexShader
    const patched = patchTreeWindVertex(src)
    expect(patched).toContain('uniform float uWindTime;')
    expect(patched).toMatch(/#include <begin_vertex>\s+#ifdef USE_INSTANCING/)
  })

  it('patches the Phong fragment shader to add the fill after the emissive map', () => {
    const patched = patchTreeFillFragment(THREE.ShaderLib.phong.fragmentShader)
    expect(patched).toContain('uniform float uTreeFill;')
    expect(patched).toMatch(/#include <emissivemap_fragment>\s+totalEmissiveRadiance \+= diffuseColor\.rgb \* uTreeFill;/)
  })

  it('keeps the trunk base planted (h/H = 0 at the bottom of the unit cylinder)', () => {
    expect(TRUNK_PART.base + TRUNK_PART.span * -0.5).toBe(0)
  })

  it('overlaps trunk top and canopy bottom so the crown sits on the trunk', () => {
    const trunkTop = TRUNK_PART.base + TRUNK_PART.span * 0.5
    const coneBottom = CANOPY_PART.base + CANOPY_PART.span * -0.5
    expect(coneBottom).toBeLessThan(trunkTop)
  })

  it('bakes a crown shade that is brightest at the top', () => {
    const geo = new THREE.ConeGeometry(1, 1, 6)
    bakeCrownShade(geo, 0.55)
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    expect(col.count).toBe(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const shade = col.getX(i)
      expect(shade).toBeGreaterThanOrEqual(0.55)
      expect(shade).toBeLessThanOrEqual(1)
      if (pos.getY(i) === 0.5) expect(shade).toBeCloseTo(1)
      if (pos.getY(i) === -0.5) expect(shade).toBeCloseTo(0.55)
    }
    geo.dispose()
  })
})
