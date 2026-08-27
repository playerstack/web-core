import { EventEmitter } from '@event-emitter';
import type { DoubleTapConfig, SkipState, DoubleTapControllerEvents } from '@typings/double-tap-controller.types';

export type { DoubleTapConfig, SkipState, DoubleTapControllerEvents } from '@typings/double-tap-controller.types';

const DEFAULT_SKIP_SECONDS = 10;
const DEFAULT_DOUBLE_TAP_DELAY = 300;
const DEFAULT_DISPLAY_DURATION = 1000;

/**
 * Framework-agnostic double-tap skip controller.
 *
 * Detects double-tap on left (backward) and right (forward) zones.
 * Accumulates skip seconds on repeated taps within the display duration.
 * Auto-hides the skip indicator after a configurable display duration.
 *
 * Skin packages call `handleTapLeft()` / `handleTapRight()` from gesture handlers
 * and subscribe to `skip` / `singleTap` events for reactive UI updates.
 */
export class DoubleTapController extends EventEmitter<
  DoubleTapControllerEvents & Record<string, (...args: any[]) => void>
> {
  private _skipSeconds: number;
  private _doubleTapDelay: number;
  private _displayDuration: number;
  private _state: SkipState = { direction: null, visible: false, seconds: 0 };

  private _tapCountLeft = 0;
  private _tapCountRight = 0;
  private _tapTimerLeft: ReturnType<typeof setTimeout> | null = null;
  private _tapTimerRight: ReturnType<typeof setTimeout> | null = null;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  // Skin provides these via setters so controller can compute new time
  private _currentTime = 0;
  private _duration = 0;
  private _onSeek: ((time: number) => void) | null = null;

  constructor(config: DoubleTapConfig = {}) {
    super();
    this._skipSeconds = config.skipSeconds ?? DEFAULT_SKIP_SECONDS;
    this._doubleTapDelay = config.doubleTapDelay ?? DEFAULT_DOUBLE_TAP_DELAY;
    this._displayDuration = config.displayDuration ?? DEFAULT_DISPLAY_DURATION;
  }

  // ─── Public Getters ───────────────────────────────────────

  get state(): SkipState {
    return this._state;
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Update current time info so the controller can compute seek targets.
   */
  setTimeInfo(currentTime: number, duration: number): void {
    this._currentTime = currentTime;
    this._duration = duration;
  }

  /**
   * Set the seek callback invoked when a skip is executed.
   */
  setOnSeek(cb: (time: number) => void): void {
    this._onSeek = cb;
  }

  /**
   * Handle tap on the left zone (backward skip).
   */
  handleTapLeft(): void {
    if (this._destroyed) return;
    this._tapCountLeft++;

    if (this._tapCountLeft === 1) {
      this._tapTimerLeft = setTimeout(() => {
        this._tapCountLeft = 0;
        this.emit('singleTap', 'left');
      }, this._doubleTapDelay);
    } else {
      if (this._tapTimerLeft) clearTimeout(this._tapTimerLeft);
      this._tapCountLeft = 0;
      this._doSkip('backward');
    }
  }

  /**
   * Handle tap on the right zone (forward skip).
   */
  handleTapRight(): void {
    if (this._destroyed) return;
    this._tapCountRight++;

    if (this._tapCountRight === 1) {
      this._tapTimerRight = setTimeout(() => {
        this._tapCountRight = 0;
        this.emit('singleTap', 'right');
      }, this._doubleTapDelay);
    } else {
      if (this._tapTimerRight) clearTimeout(this._tapTimerRight);
      this._tapCountRight = 0;
      this._doSkip('forward');
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Destroy controller — clear all pending timers and remove listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._tapTimerLeft) clearTimeout(this._tapTimerLeft);
    if (this._tapTimerRight) clearTimeout(this._tapTimerRight);
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  private _doSkip(direction: 'forward' | 'backward'): void {
    if (isNaN(this._duration) || this._duration <= 0) return;

    const delta = direction === 'forward' ? this._skipSeconds : -this._skipSeconds;
    const newTime = Math.max(0, Math.min(this._duration, this._currentTime + delta));

    if (this._onSeek) this._onSeek(newTime);

    // Accumulate seconds if same direction and still visible
    const accumulatedSeconds =
      this._state.direction === direction && this._state.visible
        ? this._state.seconds + this._skipSeconds
        : this._skipSeconds;

    this._state = { direction, visible: true, seconds: accumulatedSeconds };
    this.emit('skip', this._state);

    // Auto-hide after displayDuration
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this._state = { direction: null, visible: false, seconds: 0 };
      this.emit('skip', this._state);
      this._hideTimer = null;
    }, this._displayDuration);
  }
}
