import { EventEmitter } from '@event-emitter';
import type { UIControllerConfig, UIControllerEvents } from '@typings/ui-controller.types';

export type { UIControllerConfig, UIControllerEvents } from '@typings/ui-controller.types';

const DEFAULT_HIDE_DELAY = 3000;

/**
 * Framework-agnostic UI state controller for player controls.
 *
 * Manages auto-hide visibility, lock/unlock (for hover/interaction),
 * mobile tap-toggle, and settings panel state. Emits events that
 * skin packages subscribe to for reactive updates.
 */
export class UIController extends EventEmitter<UIControllerEvents & Record<string, (...args: any[]) => void>> {
  private _isControlsVisible = true;
  private _isLocked = false;
  private _settingsOpen = false;
  private _hideDelay: number;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  constructor(config: UIControllerConfig = {}) {
    super();
    this._hideDelay = config.hideDelay ?? DEFAULT_HIDE_DELAY;
  }

  // ─── Public Getters ───────────────────────────────────────

  get isControlsVisible(): boolean {
    return this._isControlsVisible;
  }

  get settingsOpen(): boolean {
    return this._settingsOpen;
  }

  get isLocked(): boolean {
    return this._isLocked;
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Show controls and start auto-hide timer (unless locked).
   * Resets timer if already running.
   */
  show(): void {
    if (this._destroyed) return;
    this._clearTimer();
    this._setVisible(true);
    if (!this._isLocked) {
      this._startTimer();
    }
  }

  /**
   * Hide controls immediately.
   */
  hide(): void {
    if (this._destroyed) return;
    this._clearTimer();
    this._setVisible(false);
  }

  /**
   * Toggle controls visibility (mobile tap behavior).
   * When toggling to visible, starts auto-hide timer unless locked.
   */
  toggle(): void {
    if (this._destroyed) return;
    if (this._isControlsVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Lock controls visible — pauses auto-hide timer.
   * Used when user is hovering controls or interacting with settings.
   */
  lock(): void {
    if (this._destroyed) return;
    this._isLocked = true;
    this._clearTimer();
    this._setVisible(true);
  }

  /**
   * Unlock and resume auto-hide behavior.
   */
  unlock(): void {
    if (this._destroyed) return;
    this._isLocked = false;
    this._startTimer();
  }

  /**
   * Toggle settings panel open/closed.
   */
  toggleSettings(): void {
    if (this._destroyed) return;
    this._settingsOpen = !this._settingsOpen;
    this.emit('settingsChange', this._settingsOpen);
  }

  /**
   * Destroy controller — clear timers and remove all listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._clearTimer();
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  private _setVisible(visible: boolean): void {
    if (this._isControlsVisible !== visible) {
      this._isControlsVisible = visible;
      this.emit('controlsVisibilityChange', visible);
    }
  }

  private _startTimer(): void {
    this._clearTimer();
    this._hideTimer = setTimeout(() => {
      this._setVisible(false);
    }, this._hideDelay);
  }

  private _clearTimer(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }
}
