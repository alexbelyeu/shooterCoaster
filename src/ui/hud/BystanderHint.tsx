import { useEffect, useMemo, useState } from 'react'
import { eventBus } from '@/core/EventBus'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { BYSTANDER_HIT_EVENT, bystanderHint, bystanderType } from '@/combat/bystanders'

const SHOW_MS = 3000

/**
 * Teaches a level's don't-shoot rule (#518): a one-line hint the first time a player starts a level with bystanders
 * (once per browser, `bystanderHintSeen`), and again after the first bystander hit of a run.
 */
export default function BystanderHint({ levelId }: { levelId: string }) {
  const type = useMemo(() => bystanderType(getLevelConfig(levelId)?.enemies ?? []), [levelId])
  const playing = useGameStore((s) => s.phase === 'playing')
  const runId = useGameStore((s) => s.runId)
  /** Bumped per showing, 0 when hidden; the key restarts the fade-in. */
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!type || !playing) return
    const settings = useSettingsStore.getState()
    if (settings.bystanderHintSeen) return
    settings.setBystanderHintSeen(true)
    setShown((n) => n + 1)
  }, [type, playing])

  useEffect(() => {
    if (!type) return
    let shownThisRun = false
    const onHit = () => {
      if (shownThisRun) return
      shownThisRun = true
      setShown((n) => n + 1)
    }
    eventBus.on(BYSTANDER_HIT_EVENT, onHit)
    return () => eventBus.off(BYSTANDER_HIT_EVENT, onHit)
  }, [type, runId])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(0), SHOW_MS)
    return () => clearTimeout(t)
  }, [shown])

  if (!type || !shown) return null
  return (
    <div key={shown} className="hud-bystander-hint" role="status">
      {bystanderHint(type)}
    </div>
  )
}
