import { useMemo, useState, useCallback, useEffect, useRef, useContext } from 'react'
import * as THREE from 'three'
import type { EnemyType, EnemyWave } from '@/types/level'
import { useGameStore } from '@/store/useGameStore'
import { eventBus } from '@/core/EventBus'
import { TerrainContext } from '@/levels/environments/TerrainContext'
import type { HeightFunction } from '@/utils/terrainNoise'
import Balloon from '../enemies/Balloon'
import Crow from '../enemies/Crow'
import Scorpion from '../enemies/Scorpion'
import Shark from '../enemies/Shark'
import Jellyfish from '../enemies/Jellyfish'
import FlyingFish from '../enemies/FlyingFish'
import Snowman from '../enemies/Snowman'
import SnowmanScout from '../enemies/SnowmanScout'
import SnowmanBrute from '../enemies/SnowmanBrute'
import GoldenBalloon from '../enemies/GoldenBalloon'
import { getExplosionPool } from '@/effects/explosionPoolHandle'

interface EnemySpawnerProps {
  waves: EnemyWave[]
}

interface SpawnedEnemy {
  id: string
  type: EnemyType | 'goldenBalloon'
  position: THREE.Vector3
  scoreValue: number
  radius: number
  waveIndex: number
}

const SCORE_VALUES: Record<EnemyType, number> = {
  balloon: 13,
  crow: 15,
  scorpion: 20,
  shark: 25,
  jellyfish: 18,
  flyingFish: 12,
  snowman: 30,
  snowmanScout: 15,
  snowmanBrute: 50,
}

const RADII: Record<EnemyType, number> = {
  balloon: 45,
  crow: 50,
  scorpion: 55,
  shark: 50,
  jellyfish: 40,
  flyingFish: 35,
  snowman: 115,
  snowmanScout: 70,
  snowmanBrute: 180,
}

/**
 * Spawn enemies with terrain-aware positioning.
 * Ground enemies (scorpion, snowman) sit on the terrain surface.
 * Flying enemies (crow, balloon) hover above the terrain.
 * Sharks sit at water level (y=2).
 */
function generateEnemies(waves: EnemyWave[], heightFn: HeightFunction): SpawnedEnemy[] {
  const enemies: SpawnedEnemy[] = []
  let id = 0

  // Assign logical wave groups: consecutive entries with spawnDelay 0
  // (or undefined) share the same wave group. A non-zero spawnDelay
  // starts a new group.
  let logicalWave = 0
  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    const wave = waves[waveIdx]
    if (waveIdx > 0 && (wave.spawnDelay ?? 0) > 0) {
      logicalWave++
    }
    for (let i = 0; i < wave.count; i++) {
      let x: number, y: number, z: number

      switch (wave.type) {
        case 'crow': {
          const r = Math.sqrt(Math.random()) * 1200 + 100
          const theta = Math.random() * 2 * Math.PI
          x = Math.cos(theta) * r
          z = Math.sin(theta) * r
          y = heightFn(x, z) + 15 + Math.random() * 45
          break
        }
        case 'scorpion': {
          const r = Math.sqrt(Math.random()) * 900 + 150
          const theta = Math.random() * 2 * Math.PI
          x = Math.cos(theta) * r
          z = Math.sin(theta) * r
          y = heightFn(x, z) + 5
          break
        }
        case 'shark':
        case 'jellyfish':
        case 'flyingFish': {
          // Aquatic enemies: only spawn where terrain is below water (y=0)
          let attempts = 0
          do {
            const r = Math.sqrt(Math.random()) * 1000 + 100
            const theta = Math.random() * 2 * Math.PI
            x = Math.cos(theta) * r
            z = Math.sin(theta) * r
            attempts++
          } while (heightFn(x, z) > -5 && attempts < 20)

          if (wave.type === 'shark') {
            y = 2
          } else if (wave.type === 'jellyfish') {
            y = -15 - Math.random() * 30
          } else {
            y = 0
          }
          break
        }
        case 'snowman':
        case 'snowmanScout':
        case 'snowmanBrute': {
          const r = Math.sqrt(Math.random()) * 2000 + 100
          const theta = Math.random() * 2 * Math.PI
          x = Math.cos(theta) * r
          z = Math.sin(theta) * r
          y = heightFn(x, z) + 5
          break
        }
        default: {
          // Scatter balloons across a huge area well beyond the track (~±1100).
          // Use sqrt for uniform area density across a circle of radius 3500.
          const r = Math.sqrt(Math.random()) * 3500
          const theta = Math.random() * 2 * Math.PI
          x = Math.cos(theta) * r
          z = Math.sin(theta) * r
          y = heightFn(x, z) + 40 + Math.random() * 160
          break
        }
      }

      enemies.push({
        id: `enemy-${id++}`,
        type: wave.type,
        position: new THREE.Vector3(x, y, z),
        scoreValue: SCORE_VALUES[wave.type],
        radius: RADII[wave.type],
        waveIndex: logicalWave,
      })
    }
  }

  return enemies
}

// Generate golden balloon spawn positions
function generateGoldenBalloons(count: number, heightFn: HeightFunction): SpawnedEnemy[] {
  const goldens: SpawnedEnemy[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 3000
    const theta = Math.random() * 2 * Math.PI
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    goldens.push({
      id: `golden-${i}`,
      type: 'goldenBalloon',
      position: new THREE.Vector3(
        x,
        heightFn(x, z) + 50 + Math.random() * 100,
        z,
      ),
      scoreValue: 13 * 5, // 5x points
      radius: 45,
      waveIndex: -1, // always visible
    })
  }
  return goldens
}

const ENEMY_COMPONENTS: Record<EnemyType, React.ComponentType<any>> = {
  balloon: Balloon,
  crow: Crow,
  scorpion: Scorpion,
  shark: Shark,
  jellyfish: Jellyfish,
  flyingFish: FlyingFish,
  snowman: Snowman,
  snowmanScout: SnowmanScout,
  snowmanBrute: SnowmanBrute,
}

const EXPLOSION_COLORS = ['#ff4444', '#ffaa00', '#ffffff', '#44aaff', '#00ff88']

export default function EnemySpawner({ waves }: EnemySpawnerProps) {
  const heightFn = useContext(TerrainContext)
  const enemies = useMemo(() => generateEnemies(waves, heightFn), [waves, heightFn])
  const goldenBalloons = useMemo(() => generateGoldenBalloons(3, heightFn), [heightFn])
  const phase = useGameStore((s) => s.phase)

  // Pre-computed lookups to avoid linear scans in onKill
  const enemyWaveMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of enemies) map.set(e.id, e.waveIndex)
    return map
  }, [enemies])
  const waveSizes = useMemo(() => {
    const sizes = new Map<number, number>()
    for (const e of enemies) sizes.set(e.waveIndex, (sizes.get(e.waveIndex) ?? 0) + 1)
    return sizes
  }, [enemies])

  // Wave state
  const [activeWaveIndex, setActiveWaveIndex] = useState(0)
  const [waveAnnouncement, setWaveAnnouncement] = useState<string | null>(
    waves[0]?.waveLabel ?? null,
  )
  const waveKillCounts = useRef<number[]>(waves.map(() => 0))
  const waveTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const slowMoResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track killed enemies per wave
  const killedEnemies = useRef(new Set<string>())

  // Slow-mo on final kill
  const totalEnemyCount = useMemo(
    () => enemies.length,
    [enemies],
  )

  // Report enemy counts to the store for the HUD
  const setEnemyCounts = useGameStore((s) => s.setEnemyCounts)
  useEffect(() => {
    setEnemyCounts(totalEnemyCount, totalEnemyCount)
  }, [totalEnemyCount, setEnemyCounts])

  // Clear announcement after 2s
  useEffect(() => {
    if (!waveAnnouncement) return
    const t = setTimeout(() => setWaveAnnouncement(null), 2000)
    return () => clearTimeout(t)
  }, [waveAnnouncement])

  // Clean up timers
  useEffect(() => {
    return () => {
      waveTimers.current.forEach(clearTimeout)
      waveTimers.current = []
      if (slowMoResetTimer.current) clearTimeout(slowMoResetTimer.current)
      slowMoResetTimer.current = null
      killedEnemies.current.clear()
    }
  }, [])

  const onKill = useCallback(
    (id: string, position: THREE.Vector3) => {
      killedEnemies.current.add(id)

      // Update HUD enemy count
      const remaining = totalEnemyCount - killedEnemies.current.size
      useGameStore.getState().setEnemyCounts(Math.max(0, remaining), totalEnemyCount)

      // Find which wave this enemy belongs to (O(1) lookup)
      const waveIndex = enemyWaveMap.get(id) ?? -1
      if (waveIndex >= 0) {
        waveKillCounts.current[waveIndex]++

        // Check if current wave is fully killed
        if (waveIndex === activeWaveIndex) {
          const waveSize = waveSizes.get(activeWaveIndex) ?? 0
          if (waveKillCounts.current[activeWaveIndex] >= waveSize) {
            // Advance to next wave after delay
            const nextWave = activeWaveIndex + 1
            if (nextWave < waves.length) {
              const delay = (waves[nextWave].spawnDelay ?? 3) * 1000
              const t = setTimeout(() => {
                setActiveWaveIndex(nextWave)
                if (waves[nextWave].waveLabel) {
                  setWaveAnnouncement(waves[nextWave].waveLabel!)
                }
              }, delay)
              waveTimers.current.push(t)
            }
          }
        }
      }

      // Check if this was the final enemy kill for slow-mo
      if (killedEnemies.current.size >= totalEnemyCount) {
        const store = useGameStore.getState()
        store.setTimeScale(0.1)
        if (slowMoResetTimer.current) clearTimeout(slowMoResetTimer.current)
        slowMoResetTimer.current = setTimeout(() => {
          useGameStore.getState().setTimeScale(1)
        }, 1500)
      }

      // Fire explosion from pool
      const color = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)]
      getExplosionPool()?.activate(position, color)
    },
    [enemyWaveMap, waveSizes, activeWaveIndex, waves, totalEnemyCount],
  )

  // Emit wave announcement via EventBus for UI to pick up
  useEffect(() => {
    if (waveAnnouncement) {
      eventBus.emit('wave:announce', waveAnnouncement)
    }
  }, [waveAnnouncement])

  // Determine which enemies are visible based on active waves
  const visibleEnemies = useMemo(() => {
    return enemies.filter((e) => e.waveIndex <= activeWaveIndex)
  }, [enemies, activeWaveIndex])

  return (
    <>
      {visibleEnemies.map((enemy) => {
        const Component = ENEMY_COMPONENTS[enemy.type as EnemyType]
        if (!Component) return null
        return (
          <Component
            key={enemy.id}
            id={enemy.id}
            type={enemy.type}
            spawnPosition={enemy.position}
            scoreValue={enemy.scoreValue}
            radius={enemy.radius}
            onKill={onKill}
          />
        )
      })}
      {goldenBalloons.map((gb) => (
        <GoldenBalloon
          key={gb.id}
          id={gb.id}
          type="balloon"
          spawnPosition={gb.position}
          scoreValue={gb.scoreValue}
          radius={gb.radius}
          onKill={onKill}
        />
      ))}
    </>
  )
}
