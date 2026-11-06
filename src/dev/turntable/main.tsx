import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { BACKGROUND, Stage, type DrawBoard, type DrawResult } from './Stage'
import { LAYOUT, SUBJECTS, boardCells, boardGrid, boardName, boardSize, parseQuery, subjectById, type Board } from './subjects'

/** Dev-only: never part of the game's build (`vite build --mode turntable`, `npm run turntable`). */
interface TurntableApi {
  subjects: string[]
  /** True once the board in the URL is drawn. */
  ready: boolean
  /** The window size `board` needs. */
  size: (board: Board) => { width: number; height: number }
  draw: (board: Board) => Promise<DrawResult>
  /** Its motion strip must change frame to frame. */
  animated: (id: string) => boolean
}

declare global {
  interface Window {
    __TT__?: TurntableApi
  }
}

const query = parseQuery(location.search)
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

interface Job {
  board: Board
  n: number
  done: (result: DrawResult) => void
  fail: (error: unknown) => void
}

function App() {
  const [job, setJob] = useState<Job | null>(null)
  const squares = useRef<HTMLElement[]>([])
  const n = useRef(0)

  const api = useMemo<TurntableApi>(() => {
    const draw = (board: Board) => new Promise<DrawResult>((done, fail) => setJob({ board, n: ++n.current, done, fail }))
    return { subjects: SUBJECTS.map((s) => s.id), ready: false, size: boardSize, draw, animated: (id) => subjectById(id)?.animated ?? false }
  }, [])
  window.__TT__ = api

  useEffect(() => {
    api.draw(query.board).then(() => (api.ready = true), (error) => console.error(error))
  }, [api])

  const cells = useMemo(() => (job ? boardCells(job.board) : []), [job])
  const subjects = useMemo(() => [...new Set(cells.map((c) => c.subject))], [cells])

  const onReady = useCallback(
    async (draw: DrawBoard) => {
      if (!job) return
      try {
        await nextFrame()
        const result = draw(cells, squares.current)
        await nextFrame()
        job.done(result)
      } catch (error) {
        job.fail(error)
      }
    },
    [job, cells],
  )

  if (!job) return null
  const { columns, cellPx } = boardGrid(job.board)
  const { pad, gap, header, label } = LAYOUT
  const light = query.biome ? `${query.biome} atmosphere` : 'studio light'
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <Canvas
          key={job.n}
          frameloop="never"
          dpr={1}
          camera={{ fov: 30 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <Stage subjects={subjects} biome={query.biome} onReady={onReady} />
        </Canvas>
      </div>
      <main style={{ position: 'relative', padding: pad }}>
        <h1 style={{ height: header, margin: 0, fontSize: 18, fontWeight: 600 }}>
          ShooterCoaster turntable · {boardName(job.board)} · {light}
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, ${cellPx}px)`, gap }}>
          {cells.map((cell, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <figcaption style={{ height: label, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>{cell.subject.id}</b>
                <span style={{ opacity: 0.7 }}>{cell.caption}</span>
              </figcaption>
              <div
                ref={(el) => void (el && (squares.current[i] = el))}
                style={{ width: cellPx, height: cellPx, outline: `1px solid ${BACKGROUND}` }}
              />
            </figure>
          ))}
        </div>
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
