/**
 * Typed event emitter for the media engine.
 * Minimal implementation — no external dependencies.
 */
export class EventEmitter<Events extends Record<string, (...args: any[]) => void>> {
  private listeners = new Map<keyof Events, Set<(...args: any[]) => void>>();

  on<K extends keyof Events>(event: K, handler: Events[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return this;
  }

  off<K extends keyof Events>(event: K, handler: Events[K]): this {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  once<K extends keyof Events>(event: K, handler: Events[K]): this {
    const wrapper = ((...args: any[]) => {
      this.off(event, wrapper as Events[K]);
      (handler as (...args: any[]) => void)(...args);
    }) as Events[K];
    return this.on(event, wrapper);
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[PlayerStack] Error in "${String(event)}" handler:`, err);
      }
    });
  }

  removeAllListeners(event?: keyof Events): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
