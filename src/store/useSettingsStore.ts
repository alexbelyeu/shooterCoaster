import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScreenShakeLevel } from '@/combat/screenShake'

interface SettingsState {
  musicVolume: number
  sfxVolume: number
  mouseSensitivity: number
  showFPS: boolean
  muted: boolean
  /** Kill camera trauma. prefers-reduced-motion forces it off regardless. */
  screenShake: ScreenShakeLevel
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  setMouseSensitivity: (v: number) => void
  setShowFPS: (v: boolean) => void
  toggleMute: () => void
  setScreenShake: (v: ScreenShakeLevel) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.7,
      sfxVolume: 0.8,
      mouseSensitivity: 1.0,
      showFPS: false,
      muted: false,
      screenShake: 'reduced',
      setMusicVolume: (v) => set({ musicVolume: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
      setMouseSensitivity: (v) => set({ mouseSensitivity: v }),
      setShowFPS: (v) => set({ showFPS: v }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setScreenShake: (v) => set({ screenShake: v }),
    }),
    { name: 'shootercoaster-settings' },
  ),
)
