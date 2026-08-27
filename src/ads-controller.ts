import { EventEmitter } from '@event-emitter';
import type { AdsConfig } from '@typings/adapters.types';
import type { AdsControllerEvents, AdsState } from '@typings/ads-controller.types';

export type { AdsControllerEvents, AdsState } from '@typings/ads-controller.types';
export type { AdsConfig } from '@typings/adapters.types';

/**
 * Pure per-frame ad-playback computation (framework-agnostic, side-effect-free).
 *
 * Given the ad config, the current time, the duration and whether the ad is active, it derives
 * `hasSkipTimer`, `canSkip`, `skipCountdown` (ceil of remaining seconds) and `adProgress` (0..1).
 * This is the single source of truth for the ad math so both `AdsController` and any framework
 * skin (which needs a SYNCHRONOUS derivation for its render) compute identical values without
 * duplicating the formulas.
 */
export function computeAdPlaybackState(params: {
  ads: AdsConfig | null | undefined;
  currentTime: number;
  duration: number;
  isActive: boolean;
}): { hasSkipTimer: boolean; canSkip: boolean; skipCountdown: number; adProgress: number } {
  const { ads, currentTime, duration, isActive } = params;
  const skipAfter = ads?.skipAfter;
  const hasSkipTimer = isActive && typeof skipAfter === 'number' && skipAfter > 0;

  if (!isActive) {
    return { hasSkipTimer: false, canSkip: false, skipCountdown: 0, adProgress: 0 };
  }

  const canSkip = hasSkipTimer && currentTime >= skipAfter!;
  const skipCountdown = hasSkipTimer ? Math.max(0, Math.ceil(skipAfter! - currentTime)) : 0;

  let adProgress = 0;
  if (hasSkipTimer) {
    adProgress = Math.min(1, currentTime / skipAfter!);
  } else if (duration > 0) {
    adProgress = currentTime / duration;
  }

  return { hasSkipTimer, canSkip, skipCountdown, adProgress };
}

/**
 * Framework-agnostic ads controller.
 *
 * Manages pre-roll activation (first play), skip timer computation,
 * progress tracking, and completion detection. Emits events that
 * skin packages subscribe to for reactive ad overlay updates.
 */
export class AdsController extends EventEmitter<AdsControllerEvents & Record<string, (...args: any[]) => void>> {
  private _ads: AdsConfig | null = null;
  private _adStarted = false;
  private _adCompleted = false;
  private _destroyed = false;
  private _skippableEmitted = false;

  // ─── Public API ───────────────────────────────────────────

  /**
   * Configure the controller with an ad config, or null to deactivate.
   * Resets internal state.
   */
  configure(ads: AdsConfig | null): void {
    if (this._destroyed) return;
    const wasConfigured = this._ads !== null;
    const isConfigured = ads !== null;
    this._ads = ads;
    this._adStarted = false;
    this._adCompleted = false;
    this._skippableEmitted = false;
    // When ads toggle (on→off or off→on), the media source changes (ad-url vs original). Emit
    // `sourceReset` so the skin knows to reload the media element from position 0 — the
    // framework-agnostic contract for "the underlying source changed, start fresh".
    if (wasConfigured !== isConfigured) {
      this.emit('sourceReset');
    }
  }

  /**
   * Notify the controller that playback started.
   * Triggers pre-roll activation on first call when ads are configured.
   */
  notifyPlay(): void {
    if (this._destroyed) return;
    if (this._ads && !this._adStarted) {
      this._adStarted = true;
      this.emit('adActivated');
    }
  }

  /**
   * Update ad state based on current playback position.
   * Should be called on each time update while ad is active.
   */
  update(currentTime: number, duration: number, ended: boolean): void {
    if (!this._ads || !this._adStarted || this._destroyed) return;

    const { hasSkipTimer, canSkip, skipCountdown, adProgress } = computeAdPlaybackState({
      ads: this._ads,
      currentTime,
      duration,
      isActive: true,
    });

    this.emit('adProgress', { progress: adProgress, canSkip, skipCountdown });
    this.emit('stateChange', {
      isAdActive: true,
      hasSkipTimer,
      canSkip,
      skipCountdown,
      adProgress,
    });

    if (canSkip && !this._skippableEmitted) {
      this._skippableEmitted = true;
      this.emit('adSkippable');
    }

    if (ended && !this._adCompleted) {
      this._adCompleted = true;
      this.emit('adCompleted');
      if (this._ads.onAdComplete) this._ads.onAdComplete();
    }
  }

  /**
   * Called when the user skips the ad.
   */
  onSkip(): void {
    if (this._destroyed) return;
    if (this._ads?.onSkip) this._ads.onSkip();
  }

  /**
   * Called when the user clicks the ad overlay.
   */
  onAdClick(): void {
    if (this._destroyed) return;
    if (this._ads?.onAdClick) this._ads.onAdClick();
  }

  // ─── Public Getters ───────────────────────────────────────

  get isAdActive(): boolean {
    return this._adStarted && this._ads !== null;
  }

  get state(): AdsState {
    return {
      isAdActive: this.isAdActive,
      hasSkipTimer: this.isAdActive && typeof this._ads!.skipAfter === 'number' && this._ads!.skipAfter! > 0,
      canSkip: false,
      skipCountdown: 0,
      adProgress: 0,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Destroy controller — remove all listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.removeAllListeners();
  }
}
