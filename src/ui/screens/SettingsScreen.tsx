import { useSettingsStore } from '@/store/useSettingsStore'

interface SettingsScreenProps {
  onClose: () => void
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const {
    musicVolume,
    sfxVolume,
    mouseSensitivity,
    showFPS,
    setMusicVolume,
    setSfxVolume,
    setMouseSensitivity,
    setShowFPS,
  } = useSettingsStore()

  return (
    <div className="pause-screen">
      <h2>Settings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '300px' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Music</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            style={{ width: '150px' }}
          />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SFX</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVolume}
            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
            style={{ width: '150px' }}
          />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Mouse Sensitivity</span>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={mouseSensitivity}
            onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
            style={{ width: '150px' }}
          />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Show FPS</span>
          <input
            type="checkbox"
            checked={showFPS}
            onChange={(e) => setShowFPS(e.target.checked)}
          />
        </label>
      </div>
      <button className="play-button" style={{ marginTop: '2rem' }} onClick={onClose}>
        Back
      </button>
    </div>
  )
}
