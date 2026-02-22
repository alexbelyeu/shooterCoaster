import { create } from 'zustand'
import * as THREE from 'three'

interface PlayerState {
  // Track progress [0, 1)
  progress: number
  velocity: number
  position: THREE.Vector3
  aimRotation: { x: number; y: number }

  setProgress: (p: number) => void
  setVelocity: (v: number) => void
  setPosition: (pos: THREE.Vector3) => void
  setAimRotation: (rot: { x: number; y: number }) => void
  reset: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  progress: 0,
  velocity: 0,
  position: new THREE.Vector3(),
  aimRotation: { x: 0, y: 0 },

  setProgress: (p) => set({ progress: p }),
  setVelocity: (v) => set({ velocity: v }),
  setPosition: (pos) => set({ position: pos.clone() }),
  setAimRotation: (rot) => set({ aimRotation: rot }),
  reset: () =>
    set({
      progress: 0,
      velocity: 0,
      position: new THREE.Vector3(),
      aimRotation: { x: 0, y: 0 },
    }),
}))
