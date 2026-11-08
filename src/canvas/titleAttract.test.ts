import { describe, expect, it } from 'vitest'
import { armClickSwallow, consumeClickSwallow } from './titleAttract'

describe('click swallow', () => {
  it('swallows exactly the next click', () => {
    armClickSwallow(0)
    expect(consumeClickSwallow(10)).toBe(true)
    expect(consumeClickSwallow(20)).toBe(false)
  })
  it('expires when no click follows', () => {
    armClickSwallow(0)
    expect(consumeClickSwallow(5000)).toBe(false)
  })
})
