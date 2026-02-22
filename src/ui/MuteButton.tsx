import { useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { syncVolumes } from '@/audio/AudioEngine'

export default function MuteButton() {
  const muted = useSettingsStore((s) => s.muted)
  const toggleMute = useSettingsStore((s) => s.toggleMute)

  const handleToggle = useCallback(() => {
    toggleMute()
    setTimeout(syncVolumes, 0)
  }, [toggleMute])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        handleToggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleToggle])

  return (
    <button
      className="mute-button"
      onClick={handleToggle}
      title={muted ? 'Unmute (S)' : 'Mute (S)'}
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      )}
      <span className="mute-key-hint">S</span>
    </button>
  )
}
