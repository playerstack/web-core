import { EventEmitter } from '@event-emitter';
import type { CastAdapter, CastState } from '@typings/adapters.types';
import type { CastControllerEvents } from '@typings/cast-controller.types';

export type { CastControllerEvents } from '@typings/cast-controller.types';
export type { CastAdapter, CastState } from '@typings/adapters.types';

/**
 * Framework-agnostic cast / remote-playback controller.
 *
 * Owns the cast STATE (`castState`, device `available`, `isSupported`) and the prompt strategy —
 * try the primary cast mechanism, and on failure the adapter falls back internally (Remote
 * Playback → Presentation API on web). All platform I/O flows through the injected `CastAdapter`,
 * so this orchestration lives once for every skin. `disabled` gates casting (e.g. during ads).
 */
export class CastController extends EventEmitter<CastControllerEvents & Record<string, (...args: any[]) => void>> {
  private adapter: CastAdapter;
  private _state: CastState;
  private _available = false;
  private _disabled = false;
  private _unsubState: (() => void) | null = null;
  private _unsubAvail: (() => void) | null = null;
  private _destroyed = false;

  constructor(adapter: CastAdapter, options: { disabled?: boolean } = {}) {
    super();
    this.adapter = adapter;
    this._disabled = Boolean(options.disabled);
    this._state = adapter.getState();
    adapter.setDisabled(this._disabled);

    this._unsubState = adapter.onStateChange((state) => this._setState(state));
    this._unsubAvail = adapter.watchAvailability((available) => this._setAvailable(available));
  }

  // ─── Public Getters ───────────────────────────────────────

  get isSupported(): boolean {
    return this.adapter.isSupported();
  }

  get castState(): CastState {
    return this._state;
  }

  /** Whether casting is currently offerable: supported, a device available, and not disabled. */
  get castAvailable(): boolean {
    return this.isSupported && this._available && !this._disabled;
  }

  get disabled(): boolean {
    return this._disabled;
  }

  // ─── Public API ───────────────────────────────────────────

  /** Start a cast session (adapter handles the primary → fallback strategy). No-op when disabled. */
  prompt(): void {
    if (this._destroyed || this._disabled) return;
    this.adapter.prompt().catch(() => {
      // The adapter already attempts its fallback internally; a rejection here means every
      // mechanism failed, so leave the state as the adapter reports it (typically disconnected).
    });
  }

  /** Enable/disable casting (e.g. disabled during ads). */
  setDisabled(disabled: boolean): void {
    if (this._destroyed) return;
    this._disabled = Boolean(disabled);
    this.adapter.setDisabled(this._disabled);
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Destroy controller — unsubscribe, release the adapter session and remove listeners. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._unsubState) this._unsubState();
    if (this._unsubAvail) this._unsubAvail();
    this.adapter.destroy();
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  private _setState(state: CastState): void {
    if (this._destroyed || state === this._state) return;
    this._state = state;
    this.emit('stateChange', state);
  }

  private _setAvailable(available: boolean): void {
    if (this._destroyed || available === this._available) return;
    this._available = available;
    this.emit('availabilityChange', available);
  }
}
