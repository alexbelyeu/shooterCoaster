import { describe, expect, it } from 'vitest'
import type { EnemyWave } from '@/types/level'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { computeMaxScore, scoreAfterPenalty } from '@/levels/scoring'
import { ENEMY_PLACEMENT } from '@/entities/spawning/enemyPlacement'
import { bystanderCount, bystanderHint, bystanderType, bystanderWarning } from './bystanders'

const waves: EnemyWave[] = [
  { type: 'rat', count: 10 },
  { type: 'crow', count: 5, bystanders: { type: 'climber', count: 3 } },
  { type: 'rat', count: 4, bystanders: { type: 'climber', count: 2 } },
]

describe('bystanders', () => {
  it('count and name the roster’s bystanders', () => {
    expect(bystanderCount(waves)).toBe(5)
    expect(bystanderType(waves)).toBe('climber')
    expect(bystanderType([{ type: 'rat', count: 3 }])).toBeNull()
    expect(bystanderWarning('climber')).toBe("Don't shoot climbers!")
    expect(bystanderHint('climber')).toBe("Climbers are friends — don't shoot them!")
  })

  it('add nothing to maxScore', () => {
    const plain = waves.map(({ bystanders: _, ...w }) => w)
    expect(computeMaxScore(waves)).toBe(computeMaxScore(plain))
  })

  it('a penalty floors the score at 0', () => {
    expect(scoreAfterPenalty(50, 18)).toBe(32)
    expect(scoreAfterPenalty(10, 18)).toBe(0)
  })

  it('the Climbing Gym brings climbers from its first wave, on its walls', () => {
    const gym = getLevelConfig('level6')!
    expect(gym.enemies[0].bystanders?.type).toBe('climber')
    expect(bystanderCount(gym.enemies)).toBeGreaterThanOrEqual(6)
    for (const w of gym.enemies) if (w.bystanders) expect(ENEMY_PLACEMENT[w.bystanders.type].scatter).toBe('wall')
    expect(gym.walls?.length).toBeGreaterThan(0)
  })
})
