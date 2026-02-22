type Listener = (...args: unknown[]) => void

/** Simple typed event bus for decoupled game systems */
class EventBus {
  private listeners = new Map<string, Set<Listener>>()

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
    this.listeners.get(event)?.forEach((fn) => fn(...args))
  }

  clear() {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
