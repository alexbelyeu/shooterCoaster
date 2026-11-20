import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import {
  canCopy,
  canCopyImage,
  canShareImage,
  copyImage,
  copyShare,
  exclusive,
  nativeShare,
  SHARE_TARGETS,
  shareMode,
  sharePayloadForRun,
  shareTargetHref,
  type ShareMethod,
  type SharePayload,
} from '@/ui/share'
import { placePopover, type Placement } from '@/ui/popoverPlacement'
import { scoreCardFileName, type CardSize, type ScoreCardRun } from '@/ui/scoreCard'
import { downloadBlob, renderScoreCard } from '@/ui/scoreCardImage'

const COPIED_MS = 2000

interface Props {
  card: ScoreCardRun
  /** A share went out (the sheet completed, the line was copied, or a network link was opened). */
  onShared: (method: ShareMethod) => void
  /** Buttons the open menu must not cover (Next Level). */
  avoid?: RefObject<HTMLElement | null>[]
  /** The results reveal is done: draw the story card now, before the tap, where the sheet will take it (#374). */
  prerender?: boolean
}

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false
const cardSize = (): CardSize => (isTouch() ? 'story' : 'feed')

/** The results screen's Share button (#271): the native sheet on touch (with the score card image, #272), else a menu of image, Copy link and share-intent links. */
export default function ShareMenu({ card, onShared, avoid = [], prerender = false }: Props) {
  const { levelId, score, worldRank } = card
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'copy' | 'image_copy' | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  /** A sheet is opening or open: a second tap must not call `share()` again (#374). */
  const sharing = useRef(false)
  const copyable = canCopy(navigator)
  const imageCopyable = canCopyImage(navigator)
  /** Per size, until the card changes (the World rank came in, #445). */
  const pngs = useRef({ card, bySize: new Map<CardSize, Promise<Blob>>() })
  if (pngs.current.card !== card) pngs.current = { card, bySize: new Map() }

  function cardPng(size: CardSize): Promise<Blob> {
    const cache = pngs.current.bySize
    let png = cache.get(size)
    if (!png) {
      png = renderScoreCard(card, size)
      png.catch(() => cache.delete(size))
      cache.set(size, png)
    }
    return png
  }

  async function shareImage(): Promise<'shared' | 'cancelled' | 'failed'> {
    const payload = sharePayloadForRun(levelId, score, 'image_native', worldRank)
    const png = await cardPng('story').catch(() => null)
    if (!payload || !png) return 'failed'
    return nativeShare(navigator, { ...payload, files: [new File([png], scoreCardFileName(levelId, score), { type: 'image/png' })] })
  }

  function close(refocus: boolean) {
    setOpen(false)
    setPlacement(null)
    if (refocus) buttonRef.current?.focus()
  }

  /** The native sheet where this device has one; `failed` (or no sheet) means the menu instead. */
  async function shareSheet(native: SharePayload): Promise<'shared' | 'cancelled' | 'failed'> {
    const touch = isTouch()
    if (touch && canShareImage(navigator)) {
      const outcome = await shareImage()
      if (outcome === 'shared') onShared('image_native')
      return outcome
    }
    if (shareMode(navigator, touch, native) !== 'native') return 'failed'
    const outcome = await nativeShare(navigator, native)
    if (outcome === 'shared') onShared('native')
    return outcome
  }

  async function onButton() {
    if (open) return close(false)
    const native = sharePayloadForRun(levelId, score, 'native', worldRank)
    if (!native) return
    // null: a sheet from an earlier tap is still opening.
    if ((await exclusive(sharing, () => shareSheet(native))) !== 'failed') return
    setOpen(true)
    cardPng(cardSize()).catch(() => {})
  }

  async function onCopy() {
    const payload = sharePayloadForRun(levelId, score, 'copy', worldRank)
    if (payload && (await copyShare(navigator, payload))) {
      setCopied('copy')
      onShared('copy')
    }
  }

  async function onDownload() {
    const png = await cardPng(cardSize()).catch(() => null)
    if (!png) return
    downloadBlob(png, scoreCardFileName(levelId, score))
    onShared('image_download')
    close(true)
  }

  async function onCopyImage() {
    if (await copyImage(navigator, cardPng(cardSize()))) {
      setCopied('image_copy')
      onShared('image_copy')
    }
  }

  // iOS drops the tap's user activation if the sheet waits for the card to draw (fonts, art decode, a 1080x1920 PNG),
  // and the menu opens instead: draw it once the reveal is done. The press still starts it if this has not run.
  useEffect(() => {
    if (prerender && isTouch() && canShareImage(navigator)) cardPng('story').catch(() => {})
  }, [prerender, card])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), COPIED_MS)
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
        className="fair-plate results-share"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // The sheet needs the click's user activation, so the story card starts drawing on the press.
        onPointerDown={() => !open && isTouch() && canShareImage(navigator) && cardPng('story').catch(() => {})}
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
          <button
            type="button"
            role="menuitem"
            className={`share-item${imageCopyable ? '' : ' share-wide'}`}
            data-target="image_download"
            onClick={onDownload}
          >
            Save image
          </button>
          {imageCopyable && (
            <button type="button" role="menuitem" className="share-item" data-target="image_copy" onClick={onCopyImage}>
              {copied === 'image_copy' ? 'Copied!' : 'Copy image'}
            </button>
          )}
          {copyable && (
            <button type="button" role="menuitem" className="share-item share-copy share-wide" data-target="copy" onClick={onCopy}>
              {copied === 'copy' ? 'Copied!' : 'Copy link'}
            </button>
          )}
          {SHARE_TARGETS.map(({ id, label }) => {
            const payload = sharePayloadForRun(levelId, score, id, worldRank)
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
