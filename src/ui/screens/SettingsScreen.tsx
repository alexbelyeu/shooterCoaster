import { useState } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGameStore } from '@/store/useGameStore'
import { SCREEN_SHAKE_LEVELS, type ScreenShakeLevel } from '@/combat/screenShake'
import { usePrefersReducedMotion } from '@/ui/reducedMotion'

const SHAKE_LABELS: Record<ScreenShakeLevel, string> = { off: 'Off', reduced: 'Reduced', full: 'Full' }

interface SettingsScreenProps {
  onClose: () => void
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const {
    musicVolume,
    sfxVolume,
    mouseSensitivity,
    showFPS,
    screenShake,
    setMusicVolume,
    setSfxVolume,
    setMouseSensitivity,
    setShowFPS,
    setScreenShake,
  } = useSettingsStore()
  const reducedMotion = usePrefersReducedMotion()
  const [clearStep, setClearStep] = useState<'idle' | 'confirm' | 'cleared'>('idle')

  return (
    <div className="pause-screen">
      <h2>Settings</h2>
      <div className="settings-list">
        <label className="settings-row">
          <span>Music</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
          />
        </label>
        <label className="settings-row">
          <span>SFX</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVolume}
            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
          />
        </label>
        <label className="settings-row">
          <span>Mouse Sensitivity</span>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={mouseSensitivity}
            onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
          />
        </label>
        <div className="settings-row">
          <span id="settings-shake-label">
            Screen shake
            {reducedMotion && <small className="settings-note">Off (reduced motion)</small>}
          </span>
          <div className="settings-segmented" role="radiogroup" aria-labelledby="settings-shake-label">
            {SCREEN_SHAKE_LEVELS.map((level) => {
              const active = reducedMotion ? level === 'off' : screenShake === level
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? 'is-active' : undefined}
                  disabled={reducedMotion}
                  onClick={() => setScreenShake(level)}
                >
                  {SHAKE_LABELS[level]}
                </button>
              )
            })}
          </div>
        </div>
        <label className="settings-row">
          <span>Show FPS</span>
          <input
            type="checkbox"
            checked={showFPS}
            onChange={(e) => setShowFPS(e.target.checked)}
          />
        </label>
        <div className="settings-row settings-clear" data-step={clearStep}>
          {clearStep === 'confirm' ? (
            <>
              <span>Erase all scores, stars and leaderboards?</span>
              <div className="settings-clear-actions">
                <button type="button" onClick={() => setClearStep('idle')}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    useGameStore.getState().clearLocalData()
                    setClearStep('cleared')
                  }}
                >
                  Erase
                </button>
              </div>
            </>
          ) : (
            <>
              <span>{clearStep === 'cleared' ? 'Local data cleared' : 'Scores & leaderboards'}</span>
              <button type="button" disabled={clearStep === 'cleared'} onClick={() => setClearStep('confirm')}>
                Clear local data
              </button>
            </>
          )}
        </div>
      </div>
      <button className="play-button" style={{ marginTop: '2rem' }} onClick={onClose}>
        Back
      </button>
    </div>
  )
}
