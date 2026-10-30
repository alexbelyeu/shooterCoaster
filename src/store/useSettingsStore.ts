import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScreenShakeLevel } from '@/combat/screenShake'
import { qualityFromQuery, type GraphicsQuality } from '@/canvas/graphicsQuality'

interface SettingsState {
  musicVolume: number
  sfxVolume: number
  showFPS: boolean
  muted: boolean
  /** Kill camera trauma. Reduced motion (setting or OS) forces it off regardless. */
  screenShake: ScreenShakeLevel
  /** `auto` = high, lowering resolution on slow frames (`canvas/adaptiveDpr.ts`). */
  quality: GraphicsQuality
  /** Same as the OS `prefers-reduced-motion`, for players who haven't set that (`ui/reducedMotion.ts`). */
  reducedMotion: boolean
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  setShowFPS: (v: boolean) => void
  toggleMute: () => void
  setScreenShake: (v: ScreenShakeLevel) => void
  setQuality: (v: GraphicsQuality) => void
  setReducedMotion: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.7,
      sfxVolume: 0.8,
      showFPS: false,
      muted: false,
      screenShake: 'reduced',
      quality: 'auto',
      reducedMotion: false,
      setMusicVolume: (v) => set({ musicVolume: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
      setShowFPS: (v) => set({ showFPS: v }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setScreenShake: (v) => set({ screenShake: v }),
      setQuality: (v) => set({ quality: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
    }),
    { name: 'shootercoaster-settings' },
  ),
)

// `?quality=low` (any preset) sets the quality like the settings screen does.
const queryQuality = typeof window !== 'undefined' ? qualityFromQuery(window.location.search) : null
if (queryQuality) useSettingsStore.getState().setQuality(queryQuality)
