import * as THREE from 'three'

/**
 * Phase 2 extensible weapon architecture.
 * All weapons implement this interface for future weapons/combos/power-ups.
 */
export interface WeaponConfig {
  name: string
  fireRate: number      // ms between shots
  bulletSpeed: number
  bulletSize: number
  bulletColor: string
  bulletLifetime: number // ms
  poolSize: number
  damage: number
  spread?: number        // radians of random spread
}

export const BLASTER: WeaponConfig = {
  name: 'Blaster',
  fireRate: 100,
  bulletSpeed: 8,
  bulletSize: 10,
  bulletColor: '#ff0000',
  bulletLifetime: 5000,
  poolSize: 350,
  damage: 1,
}

export const SHOTGUN: WeaponConfig = {
  name: 'Shotgun',
  fireRate: 500,
  bulletSpeed: 10,
  bulletSize: 6,
  bulletColor: '#ffaa00',
  bulletLifetime: 2000,
  poolSize: 200,
  damage: 0.5,
  spread: 0.15,
}

export const CANNON: WeaponConfig = {
  name: 'Cannon',
  fireRate: 1000,
  bulletSpeed: 5,
  bulletSize: 40,
  bulletColor: '#000000',
  bulletLifetime: 8000,
  poolSize: 50,
  damage: 3,
}
