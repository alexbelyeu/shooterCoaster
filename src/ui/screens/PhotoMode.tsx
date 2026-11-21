import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { PHOTO_DRAG_RAD_PER_PX, PHOTO_WHEEL_PER_PX, photoFileName } from '@/track/photoCamera'
import { photoTurn, photoZoom, requestPhotoCapture } from '@/track/photoInput'
import { downloadBlob } from '@/ui/scoreCardImage'

/**
 * Photo mode (#828), over the paused ride with the pause card and HUD gone: drag (one finger) swings the camera round
 * the seat, the wheel or a pinch zooms (`track/PhotoCamera.tsx` moves it), Save downloads the frame as a PNG, Back and
 * Esc (a pad's B) go back to the pause card. Lazy: no startup JS.
 */
export default function PhotoMode() {
  const levelId = useGameStore((s) => s.currentLevel)
  const surface = useRef<HTMLDivElement>(null)
  const save = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  // Focused first, so a pad's A saves.
  useEffect(() => save.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat) useGameStore.getState().setPhoto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Native and not passive, so the wheel never scrolls or zooms the page.
  useEffect(() => {
    const el = surface.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      photoZoom(Math.exp(px * PHOTO_WHEEL_PER_PX))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const all = pointers.current
    const was = all.get(e.pointerId)
    if (!was) return
    if (all.size === 1) {
      photoTurn((e.clientX - was.x) * PHOTO_DRAG_RAD_PER_PX, (e.clientY - was.y) * PHOTO_DRAG_RAD_PER_PX)
    } else if (all.size === 2) {
      const other = [...all].find(([id]) => id !== e.pointerId)?.[1]
      if (other) {
        const before = Math.hypot(was.x - other.x, was.y - other.y)
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
        if (before > 0 && after > 0) photoZoom(before / after)
      }
    }
    was.x = e.clientX
    was.y = e.clientY
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
  }

  async function onSave() {
    if (!levelId || saved === 'saving') return
    setSaved('saving')
    const png = await requestPhotoCapture()
    if (png) downloadBlob(png, photoFileName(levelId, new Date()))
    setSaved(png ? 'saved' : 'failed')
  }

  const line =
    saved === 'saved' ? 'Saved to your downloads. Take another?'
      : saved === 'failed' ? "The picture didn't take. Try Save again."
        : null

  return (
    <div className="photo-mode" data-no-fire>
      <div
        ref={surface}
        className="photo-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="photo-bar">
        <p className="photo-hint fair-over-ride" aria-live="polite">
          {line ?? (
            <>
              <span className="photo-hint-mouse">Drag to swing the camera round, scroll to zoom.</span>
              <span className="photo-hint-touch">Drag to swing the camera round, pinch to zoom.</span>
            </>
          )}
        </p>
        <div className="photo-actions">
          <button className="fair-plate" onClick={() => useGameStore.getState().setPhoto(false)}>
            Back
          </button>
          <button ref={save} className="fair-plate fair-go" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
