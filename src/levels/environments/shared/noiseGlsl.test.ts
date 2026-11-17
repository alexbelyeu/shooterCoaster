import { describe, expect, it } from 'vitest'

// Every source module, as text (Vite's raw glob: no DOM, no three)
const SOURCES: Record<string, string> = import.meta.glob(['../../../**/*.{ts,tsx}', '!../../../**/*.test.*'], { query: '?raw', import: 'default', eager: true })

describe('FBM_OCTAVES', () => {
  it("is set from fbmOctaves by every shader that runs noiseGlsl's fbm (#582)", () => {
    const users = Object.entries(SOURCES).filter(([, src]) => src.includes('gradientNoiseGlsl') && /\bfbm\(/.test(src))
    const missing = users.filter(([path, src]) => !path.endsWith('noiseGlsl.ts') && !src.includes('FBM_OCTAVES')).map(([path]) => path)
    expect(users.length).toBeGreaterThan(3)
    expect(missing).toEqual([])
  })
})
