import { EventEmitter } from '@event-emitter';
import type { FullscreenAdapter } from '@typings/adapters.types';
import type { FullscreenControllerEvents } from '@typings/fullscreen-controller.types';

export type { FullscreenControllerEvents } from '@typings/fullscreen-controller.types';
export type { FullscreenAdapter } from '@typings/adapters.types';

/**
 * Framework-agnostic fullscreen controller.
 *
 * Owns the fullscreen STATE and the request/exit/toggle decision, and mirrors the platform's
 * fullscreen changes into a single `fullscreenChange` event skins subscribe to. All platform I/O
 * (the Fullscreen API with its vendor prefixes on web, or a native immersive-mode toggle) flows
 * through the injected `FullscreenAdapter`, so the toggle logic lives here once for every skin.
 */
export class FullscreenController extends EventEmitter<
  FullscreenControllerEvents & Record<string, (...args: any[]) => void>
> {
  private adapter: FullscreenAdapter;
  private _isFullscreen = false;
  private _unsubscribe: (() => void) | null = null;
  private _destroyed = false;

  constructor(adapter: FullscreenAdapter) {
    super();
    this.adapter = adapter;
    this._isFullscreen = adapter.isFullscreen();
    this._unsubscribe = adapter.onChange(() => this._syncFromAdapter());
  }

  // ─── Public Getters ───────────────────────────────────────

  get isFullscreen(): boolean {
    return this._isFullscreen;
  }

  // ─── Public API ───────────────────────────────────────────

  /** Request fullscreen for the player. */
  request(): void {
    if (this._destroyed) return;
    this.adapter.request();
  }

  /** Exit fullscreen. */
  exit(): void {
    if (this._destroyed) return;
    this.adapter.exit();
  }

  /** Toggle fullscreen based on the current state (exit if fullscreen, else request). */
  toggle(): void {
    if (this._destroyed) return;
    if (this.adapter.isFullscreen()) {
      this.adapter.exit();
    } else {
      this.adapter.request();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Destroy controller — unsubscribe from the adapter and remove listeners. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  private _syncFromAdapter(): void {
    if (this._destroyed) return;
    const next = this.adapter.isFullscreen();
    this._isFullscreen = next;
    this.emit('fullscreenChange', next);
  }
}
