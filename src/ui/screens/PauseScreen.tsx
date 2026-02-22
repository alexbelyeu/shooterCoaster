import { useGameStore } from '@/store/useGameStore'

export default function PauseScreen() {
  const setPhase = useGameStore((s) => s.setPhase)

  return (
    <div className="pause-screen">
      <h2>Paused</h2>
      <button className="play-button" onClick={() => setPhase('playing')}>
        Resume
      </button>
      <button
        className="play-button"
        style={{ marginTop: '1rem', background: 'linear-gradient(135deg, #888, #555)' }}
        onClick={() => setPhase('levelSelect')}
      >
        Quit to Menu
      </button>
    </div>
  )
}
