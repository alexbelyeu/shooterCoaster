import { createPortal } from 'react-dom'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import {
  canCopy,
  canCopyImage,
  canShareImage,
  cardSizeFor,
  copyImage,
  copyShare,
  exclusive,
  nativeShare,
  SHARE_TARGETS,
  shareMode,
  sharePayload,
  shareTargetHref,
  type ShareMethod,
} from '@/ui/share'
import { FairBoard } from '@/ui/Fair'
import { isHeldActivation, menuFocus } from '@/ui/menuFocus'
import { placePopover, type Placement } from '@/ui/popoverPlacement'
import { scoreCardFileName, type CardSize, type ScoreCardRun } from '@/ui/scoreCard'
import { downloadBlob, renderScoreCard } from '@/ui/scoreCardImage'

const FLASH_MS = 2000

type FlashTarget = 'copy' | 'image_copy' | 'image_download'
/** A menu item's answer to its click (#254): "Copied!", or why nothing happened. `n` restarts the timer on a second click. */
interface Flash {
  target: FlashTarget
  ok: boolean
  n: number
}
const FAILED_LABEL: Record<FlashTarget, string> = { copy: "Couldn't copy", image_copy: "Couldn't copy", image_download: "Couldn't save" }

interface Props {
  card: ScoreCardRun
  /** A share went out (the sheet completed, the line was copied, or a network link was opened). */
  onShared: (method: ShareMethod) => void
  /** Buttons the open menu must not cover (Next Level). */
  avoid?: RefObject<HTMLElement | null>[]
  /** The results reveal is done: draw the story card now, before the tap, where the sheet will take it (#374). */
  prerender?: boolean
  /** The run's on-ride photo (#701): the card's picture in place of the postcard. */
  photo?: Blob | null
}

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false
const cardSize = (): CardSize => cardSizeFor(isTouch())

/** The results screen's Share button (#271): the native sheet on touch (with the score card image, #272), else a menu of image, Copy link and share-intent links. */
export default function ShareMenu({ card, onShared, avoid = [], prerender = false, photo = null }: Props) {
  const { levelId, score } = card
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  /** A sheet is opening or open: a second tap must not call `share()` again (#374). */
  const sharing = useRef(false)
  const copyable = canCopy(navigator)
  const imageCopyable = canCopyImage(navigator)
  /** Per size, until the card changes (the World rank came in, #445) or the photo arrives. */
  const pngs = useRef({ card, photo, bySize: new Map<CardSize, Promise<Blob>>() })
  if (pngs.current.card !== card || pngs.current.photo !== photo) pngs.current = { card, photo, bySize: new Map() }

  function cardPng(size: CardSize): Promise<Blob> {
    const cache = pngs.current.bySize
    let png = cache.get(size)
    if (!png) {
      png = renderScoreCard(card, size, photo)
      png.catch(() => cache.delete(size))
      cache.set(size, png)
    }
    return png
  }

  async function shareImage(): Promise<'shared' | 'cancelled' | 'failed'> {
    const png = await cardPng('story').catch(() => null)
    if (!png) return 'failed'
    return nativeShare(navigator, { ...sharePayload(card, 'image_native'), files: [new File([png], scoreCardFileName(levelId, score), { type: 'image/png' })] })
  }

  function showFlash(target: FlashTarget, ok: boolean) {
    setFlash((f) => ({ target, ok, n: (f?.n ?? 0) + 1 }))
  }

  function plateLabel(target: FlashTarget, idle: string): string {
    if (flash?.target !== target) return idle
    return flash.ok ? 'Copied!' : FAILED_LABEL[target]
  }

  function close(refocus: boolean) {
    setOpen(false)
    setPlacement(null)
    if (refocus) buttonRef.current?.focus()
  }

  /** The share sheet where this device has one; `failed` (a sheet that refused, or none) opens the menu instead. */
  async function shareSheet(): Promise<'shared' | 'cancelled' | 'failed'> {
    const native = sharePayload(card, 'native')
    const mode = shareMode(navigator, isTouch(), native)
    if (mode === 'menu') return 'failed'
    const outcome = mode === 'image' ? await shareImage() : await nativeShare(navigator, native)
    if (outcome === 'shared') onShared(mode === 'image' ? 'image_native' : 'native')
    return outcome
  }

  async function onButton() {
    if (open) return close(false)
    // null: a sheet from an earlier tap is still opening.
    if ((await exclusive(sharing, shareSheet)) !== 'failed') return
    setOpen(true)
    cardPng(cardSize()).catch(() => {})
  }

  async function onCopy() {
    const ok = await copyShare(navigator, sharePayload(card, 'copy'))
    showFlash('copy', ok)
    if (ok) onShared('copy')
  }

  async function onDownload() {
    const png = await cardPng(cardSize()).catch(() => null)
    if (!png) return showFlash('image_download', false)
    downloadBlob(png, scoreCardFileName(levelId, score))
    onShared('image_download')
    close(true)
  }

  async function onCopyImage() {
    const ok = await copyImage(navigator, cardPng(cardSize()))
    showFlash('image_copy', ok)
    if (ok) onShared('image_copy')
  }

  // iOS drops the tap's user activation if the sheet waits for the card to draw (fonts, art decode, a 1080x1920 PNG),
  // and the menu opens instead: draw it once the reveal is done. The press still starts it if this has not run.
  useEffect(() => {
    if (prerender && isTouch() && canShareImage(navigator)) cardPng('story').catch(() => {})
  }, [prerender, card, photo])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])

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
    if (placement) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [placement])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close(true)
    }
    // The menu is fixed to the viewport: scrolling the results screen or resizing would leave it behind.
    const onMove = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  function onMenuKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    // Enter held on Share opened the menu and moved focus to its first item: the repeat must not click it.
    if (isHeldActivation(e.key, e.repeat)) return e.preventDefault()
    // The menu is portalled to the end of body: back on Share first, so Tab carries on from there.
    if (e.key === 'Tab') return close(true)
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const to = menuFocus(items.indexOf(document.activeElement as HTMLElement), e.key, items.length)
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
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="share-menu"
            role="menu"
            aria-label="Share your score"
            data-side={placement?.side}
            style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? 'visible' : 'hidden' }}
            onKeyDown={onMenuKey}
          >
            <FairBoard className="share-board">
              <button
                type="button"
                role="menuitem"
                className={`fair-plate share-item${imageCopyable ? '' : ' share-wide'}`}
                data-target="image_download"
                onClick={onDownload}
              >
                {plateLabel('image_download', 'Save image')}
              </button>
              {imageCopyable && (
                <button type="button" role="menuitem" className="fair-plate share-item" data-target="image_copy" onClick={onCopyImage}>
                  {plateLabel('image_copy', 'Copy image')}
                </button>
              )}
              {copyable && (
                <button type="button" role="menuitem" className="fair-plate share-item share-copy share-wide" data-target="copy" onClick={onCopy}>
                  {plateLabel('copy', 'Copy link')}
                </button>
              )}
              {SHARE_TARGETS.map(({ id, label }) => {
                const email = id === 'email'
                return (
                  <a
                    key={id}
                    role="menuitem"
                    className="fair-plate share-item"
                    data-target={id}
                    href={shareTargetHref(id, sharePayload(card, id))}
                    target={email ? undefined : '_blank'}
                    rel={email ? undefined : 'noopener noreferrer'}
                    onClick={() => onTarget(id)}
                  >
                    {label}
                  </a>
                )
              })}
            </FairBoard>
          </div>,
        // Out of the results board: its notched mask would clip the menu where it hangs over the edge.
        document.body,
      )}
    </div>
  )
}
