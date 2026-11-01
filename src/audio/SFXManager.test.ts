import { describe, it, expect } from 'vitest'
import source from './SFXManager.ts?raw'

describe('SFXManager', () => {
  it('builds every Tone node through own(), so the node count sees it and disposeSFX frees it', () => {
    const bare = source.split('\n').filter((line) => /\bnew [A-Z]\w*\(/.test(line) && !/own\(new [A-Z]/.test(line))
    expect(bare).toEqual([])
  })
})
