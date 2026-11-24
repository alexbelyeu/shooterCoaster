import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { getAllLevels, getLevelConfig } from '@/levels/LevelRegistry'
import { formatRushTime, isNewBest, rushComplete, rushStages, stagesCleared } from '@/levels/bossRush'
import { FairBoard } from '@/ui/Fair'

/** The finished rush, read once on mount, before its time is saved. */
function snapshotRush() {
  const s = useGameStore.getState()
  const mode = s.runMode.mode === 'bossRush' ? s.runMode : { stage: 0, seconds: 0 }
  const stages = rushStages(getAllLevels())
  const complete = rushComplete(mode.stage, s.bossSeconds !== null, stages.length)
  return {
    seconds: mode.seconds,
    cleared: stagesCleared(mode.stage, s.bossSeconds !== null),
    total: stages.length,
    complete,
    lostOn: complete ? null : (getLevelConfig(stages[mode.stage]?.levelId ?? '')?.name ?? null),
    previousBest: s.bossRushBest,
  }
}

/** The results screen's Boss Rush cut (#1011): the rush's time, the best and the bosses beaten; no score, stars or boards. */
export default function BossRushResults() {
  const [run] = useState(snapshotRush)
  const left = useRef(false)
  const record = run.complete && isNewBest(run.seconds, run.previousBest)

  useEffect(() => {
    useGameStore.getState().saveBossRushTime(run.seconds, run.complete)
  }, [run])

  function leave(to: 'replay' | 'levels') {
    if (left.current) return
    left.current = true
    const store = useGameStore.getState()
    if (to === 'replay') store.restartRun('results')
    else store.setPhase('levelSelect')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target instanceof Element ? e.target : null
      if (e.key === 'Enter' && target?.closest('.results-screen button')) return
      if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') leave('replay')
      else if (e.key === 'Escape') leave('levels')
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [])

  const best = record ? null : run.previousBest
  return (
    <div className="results-screen fair-stage" data-sequence="done" data-mode="bossRush">
      <div className="results-card">
        <FairBoard className="results-panel" shadowClassName="results-panel-shadow fair-arrive" role="region" aria-labelledby="results-title">
          <div className="results-main">
            <h2 id="results-title" className="fair-title">
              Boss Rush
            </h2>
            <p className="results-message">
              {run.complete ? 'Every boss down. Now do it faster.' : `The ${run.lostOn ?? 'last'} boss held out. Back on for another go?`}
            </p>
            <div className={`results-score${record ? ' has-record' : ''}`}>
              <p className="results-rush-time" data-complete={run.complete}>
                {run.complete ? formatRushTime(run.seconds) : `${run.cleared} of ${run.total}`}
              </p>
              {record && <span className="results-record fair-showcard">New best</span>}
            </div>
            {best !== null && <p className="results-best">Your best is {formatRushTime(best)}</p>}
            {best === null && !record && <p className="results-best">Beat every boss to set a time</p>}
          </div>

          <div className="results-side">
            <ul className="results-stats">
              <li className="results-stat" data-stat="bosses">
                {run.cleared} of {run.total} bosses beaten
              </li>
              {run.complete && (
                <li className="results-stat" data-stat="time">
                  {formatRushTime(run.seconds)} on the clock
                </li>
              )}
            </ul>
            <div className="results-actions">
              <button className="fair-plate fair-go" onClick={() => leave('replay')}>
                Replay
              </button>
              <button className="fair-plate" onClick={() => leave('levels')}>
                Levels
              </button>
            </div>
            <p className="results-keys">Enter or R rides again. Esc takes you to the levels.</p>
          </div>
        </FairBoard>
      </div>
    </div>
  )
}
