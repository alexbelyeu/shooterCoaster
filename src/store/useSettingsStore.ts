import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  musicVolume: number
  sfxVolume: number
  mouseSensitivity: number
  showFPS: boolean
  muted: boolean
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  setMouseSensitivity: (v: number) => void
  setShowFPS: (v: boolean) => void
  toggleMute: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.7,
      sfxVolume: 0.8,
      mouseSensitivity: 1.0,
      showFPS: false,
      muted: false,
      setMusicVolume: (v) => set({ musicVolume: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
      setMouseSensitivity: (v) => set({ mouseSensitivity: v }),
      setShowFPS: (v) => set({ showFPS: v }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: 'shootercoaster-settings' },
  ),
)
