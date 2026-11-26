import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import config from '../vitest.config'

// A build-time constant declared in vite-env.d.ts but missing from vitest.config.ts's `define` is undefined under
// vitest: a module reading it at top level throws on import (#1040's `__BLENDER_CROW__` broke three test files).
describe('vitest defines', () => {
  it('defines every build-time constant vite-env.d.ts declares', () => {
    const declared = [...readFileSync('vite-env.d.ts', 'utf8').matchAll(/declare const (__\w+__)/g)].map((m) => m[1])
    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((name) => !(name in (config.define ?? {})))).toEqual([])
  })
})
