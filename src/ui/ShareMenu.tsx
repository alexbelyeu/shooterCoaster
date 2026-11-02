import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import {
  canCopy,
  copyShare,
  nativeShare,
  SHARE_TARGETS,
  shareMode,
  sharePayloadForRun,
  shareTargetHref,
  type ShareMethod,
} from '@/ui/share'
import { placePopover, type Placement } from '@/ui/popoverPlacement'

const COPIED_MS = 2000

interface Props {
  levelId: string
  score: number
  /** A share went out (the sheet completed, the line was copied, or a network link was opened). */
  onShared: (method: ShareMethod) => void
  /** Buttons the open menu must not cover (Next Level). */
  avoid?: RefObject<HTMLElement | null>[]
}

/** The results screen's Share button (#271): the native sheet on touch, else a menu of Copy link + share-intent links. */
export default function ShareMenu({ levelId, score, onShared, avoid = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const copyable = canCopy(navigator)

  function close(refocus: boolean) {
    setOpen(false)
    setPlacement(null)
    if (refocus) buttonRef.current?.focus()
  }

  async function onButton() {
    if (open) return close(false)
    const native = sharePayloadForRun(levelId, score, 'native')
    if (!native) return
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    if (shareMode(navigator, coarse, native) === 'native') {
      const outcome = await nativeShare(navigator, native)
      if (outcome === 'shared') onShared('native')
      if (outcome !== 'failed') return
    }
    setOpen(true)
  }

  async function onCopy() {
    const payload = sharePayloadForRun(levelId, score, 'copy')
    if (payload && (await copyShare(navigator, payload))) {
      setCopied(true)
      onShared('copy')
    }
  }

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  // Measured before paint, so the menu never flashes on the wrong side.
  useLayoutEffect(() => {
    const anchor = buttonRef.current
    const menu = menuRef.current
    if (!open || !anchor || !menu) return
    const avoidBoxes = avoid.flatMap((r) => (r.current ? [r.current.getBoundingClientRect()] : []))
    setPlacement(
      placePopover(anchor.getBoundingClientRect(), menu.offsetWidth, menu.offsetHeight, { width: window.innerWidth, height: window.innerHeight }, avoidBoxes),
    )
  }, [open])

  useEffect(() => {
    if (placement) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [placement])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) close(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close(true)
    }
    const onResize = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function onMenuKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    let to: number | null = null
    if (step !== undefined) to = (at + step + items.length) % items.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = items.length - 1
    else if (e.key === 'Tab') close(false)
    if (to === null) return
    e.preventDefault()
    items[to]?.focus()
  }

  function onTarget(method: ShareMethod) {
    onShared(method)
    // After the click's default action has opened the link.
    setTimeout(() => close(false), 0)
  }

  return (
    <div ref={anchorRef} className="share-anchor">
      <button
        ref={buttonRef}
        className="play-button results-secondary results-share"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onButton}
      >
        Share
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="share-menu"
          role="menu"
          aria-label="Share your score"
          data-side={placement?.side}
          style={{ left: placement?.offsetX ?? 0, visibility: placement ? 'visible' : 'hidden' }}
          onKeyDown={onMenuKey}
        >
          {copyable && (
            <button type="button" role="menuitem" className="share-item share-copy" data-target="copy" onClick={onCopy}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
          {SHARE_TARGETS.map(({ id, label }) => {
            const payload = sharePayloadForRun(levelId, score, id)
            if (!payload) return null
            const email = id === 'email'
            return (
              <a
                key={id}
                role="menuitem"
                className="share-item"
                data-target={id}
                href={shareTargetHref(id, payload)}
                target={email ? undefined : '_blank'}
                rel={email ? undefined : 'noopener noreferrer'}
                onClick={() => onTarget(id)}
              >
                {label}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
