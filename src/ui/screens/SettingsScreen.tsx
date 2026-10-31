import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGameStore } from '@/store/useGameStore'
import { SCREEN_SHAKE_LEVELS, type ScreenShakeLevel } from '@/combat/screenShake'
import { GRAPHICS_QUALITIES, type GraphicsQuality } from '@/canvas/graphicsQuality'
import { usePrefersReducedMotion, useSystemPrefersReducedMotion } from '@/ui/reducedMotion'

const SHAKE_LABELS: Record<ScreenShakeLevel, string> = { off: 'Off', reduced: 'Reduced', full: 'Full' }

const QUALITY_LABELS: Record<GraphicsQuality, string> = { auto: 'Auto', low: 'Low', medium: 'Med', high: 'High' }

const QUALITY_NOTES: Record<GraphicsQuality, string> = {
  auto: 'High, lowering resolution if frames run slow',
  low: 'Base resolution, no bloom or AA, fewer particles',
  medium: 'Up to 1.5× resolution, lighter anti-aliasing',
  high: 'Full resolution, bloom and every particle',
}

interface SegmentedProps<T extends string> {
  labelId: string
  options: readonly T[]
  labels: Record<T, string>
  value: T
  disabled?: boolean
  onChange: (value: T) => void
}

function Segmented<T extends string>({ labelId, options, labels, value, disabled, onChange }: SegmentedProps<T>) {
  return (
    <div className="settings-segmented" role="radiogroup" aria-labelledby={labelId}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={option === value ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}

function VolumeRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <span className="settings-slider">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          aria-label={`${label} volume`}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <output>{Math.round(value * 100)}%</output>
      </span>
    </label>
  )
}

function ToggleRow({ label, note, checked, disabled, onChange }: { label: string; note?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-row">
      <span>
        {label}
        {note && <small className="settings-note">{note}</small>}
      </span>
      <input type="checkbox" role="switch" className="settings-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Wipes scores, stars and leaderboards; a second tap confirms. */
function ClearDataRow() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'cleared'>('idle')

  if (step === 'confirm') {
    return (
      <div className="settings-row settings-clear" data-step="confirm">
        <span>Erase all scores, stars and leaderboards?</span>
        <div className="settings-clear-actions">
          <button type="button" onClick={() => setStep('idle')}>
            Cancel
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              useGameStore.getState().clearLocalData()
              setStep('cleared')
            }}
          >
            Erase
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="settings-row settings-clear" data-step={step}>
      <span>{step === 'cleared' ? 'Local data cleared' : 'Scores & leaderboards'}</span>
      <button type="button" disabled={step === 'cleared'} onClick={() => setStep('confirm')}>
        Clear local data
      </button>
    </div>
  )
}

interface SettingsScreenProps {
  onClose: () => void
}

/** Graphics, sound and comfort settings (persisted); opened from the title and the pause menu. Esc goes back. */
export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const s = useSettingsStore()
  const reducedMotion = usePrefersReducedMotion()
  const systemReducedMotion = useSystemPrefersReducedMotion()
  const card = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  // Once on open: `onClose` is a fresh arrow on every App render, and refocusing would steal focus.
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat) close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="pause-screen pause-menu settings-screen">
      <div ref={card} className="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">Settings</h2>

        <div className="settings-groups">
          <section className="settings-group">
            <h3>Graphics</h3>
            <div className="settings-row settings-row--stacked">
              <span id="settings-quality-label">
                Quality
                <small className="settings-note">{QUALITY_NOTES[s.quality]}</small>
              </span>
              <Segmented labelId="settings-quality-label" options={GRAPHICS_QUALITIES} labels={QUALITY_LABELS} value={s.quality} onChange={s.setQuality} />
            </div>
            <ToggleRow label="Show FPS" checked={s.showFPS} onChange={s.setShowFPS} />
          </section>

          <section className="settings-group">
            <h3>Sound</h3>
            <VolumeRow label="Music" value={s.musicVolume} onChange={s.setMusicVolume} />
            <VolumeRow label="Effects" value={s.sfxVolume} onChange={s.setSfxVolume} />
          </section>

          <section className="settings-group">
            <h3>Comfort</h3>
            <div className="settings-row">
              <span id="settings-shake-label">
                Screen shake
                {reducedMotion && <small className="settings-note">Off (reduced motion)</small>}
              </span>
              <Segmented
                labelId="settings-shake-label"
                options={SCREEN_SHAKE_LEVELS}
                labels={SHAKE_LABELS}
                value={reducedMotion ? 'off' : s.screenShake}
                disabled={reducedMotion}
                onChange={s.setScreenShake}
              />
            </div>
            <ToggleRow
              label="Reduced motion"
              note={systemReducedMotion ? 'On in your system settings' : 'Calmer camera and menus'}
              checked={reducedMotion}
              disabled={systemReducedMotion}
              onChange={s.setReducedMotion}
            />
          </section>

          <section className="settings-group">
            <h3>Data</h3>
            <ClearDataRow />
          </section>
        </div>

        <button className="play-button settings-back" onClick={onClose}>
          Back
        </button>
      </div>
    </div>
  )
}
