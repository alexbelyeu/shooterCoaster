type Listener = (...args: unknown[]) => void

/** Simple typed event bus for decoupled game systems */
class EventBus {
  private listeners = new Map<string, Set<Listener>>()
  /** See every event's name before its listeners do: the `?perf=1` recorder and the smoke's program log (#536). */
  readonly taps = new Set<(event: string) => void>()

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(fn)
  }

  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn)
  }

  emit(event: string, ...args: unknown[]) {
    for (const tap of this.taps) tap(event)
    this.listeners.get(event)?.forEach((fn) => fn(...args))
  }

  clear() {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    eventBus.clear()
  })
}
