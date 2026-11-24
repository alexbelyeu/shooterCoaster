/**
 * Virtual time for headless renders (`clip.mjs`, `rideReview.mjs`): software GL draws ~0.5 fps, so the page's clock, rAF and
 * CSS animations only move when the script steps them (decision 2026-10-28, #100).
 */

/** Page init script: seeded Math.random, a rAF that runs only on __clipFrame(), and __clipAnimations(ms) for CSS animations. */
export function virtualFrames(seed) {
  let s = seed >>> 0
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let queue = []
  let nextId = 1
  window.requestAnimationFrame = (cb) => {
    queue.push({ id: nextId, cb })
    return nextId++
  }
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter((f) => f.id !== id)
  }
  window.__clipFrame = () => {
    const due = queue
    queue = []
    const now = performance.now()
    for (const f of due) f.cb(now)
  }
  const stepped = new WeakSet()
  window.__clipAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      if (!stepped.has(a)) {
        stepped.add(a)
        a.pause()
        a.currentTime = 0
        continue
      }
      const end = a.effect?.getComputedTiming().endTime ?? Infinity
      const t = (a.currentTime ?? 0) + ms
      if (t >= end) a.finish()
      else a.currentTime = t
    }
  }
}
