// biome-ignore lint/suspicious/noExplicitAny: variance of the listener map keys
type Listener = (...args: any[]) => void

/**
 * Typed event emitter, same shape as the core one but with per-event signatures
 */
export class Emitter<Events extends Record<string, Listener>> {
  private events: { [K in keyof Events]?: Events[K][] } = {}

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) {
    const callbacks = this.events[event]
    if (!callbacks) return

    // iterate over a copy so a listener unsubscribing doesn't skip the next one
    for (const callback of callbacks.slice()) {
      callback(...args)
    }
  }

  /**
   * @returns Unsubscribe function
   */
  on<K extends keyof Events>(event: K, callback: Events[K]) {
    const callbacks = this.events[event]

    if (callbacks) {
      callbacks.push(callback)
    } else {
      this.events[event] = [callback]
    }

    return () => {
      this.off(event, callback)
    }
  }

  off<K extends keyof Events>(event: K, callback: Events[K]) {
    this.events[event] = this.events[event]?.filter((i) => i !== callback)
  }

  destroy() {
    this.events = {}
  }
}
