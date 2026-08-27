import { EventEmitter } from '@event-emitter';
import type { LiveAdAdapter } from '@typings/adapters.types';
import type { LiveAdConfig, LiveAdControllerEvents, LiveAdPhase, LiveAdState } from '@typings/live-ad-controller.types';

export type { LiveAdConfig, LiveAdControllerEvents, LiveAdPhase, LiveAdState } from '@typings/live-ad-controller.types';
export type { LiveAdAdapter } from '@typings/adapters.types';

const PHASE_IDLE: LiveAdPhase = 'idle';
const PHASE_PLAYING: LiveAdPhase = 'playing';
const PHASE_EXITING: LiveAdPhase = 'exiting';

/** Duration of the exit fade-out (ms). Must match the skin's CSS transition. */
export const EXIT_DURATION_MS = 400;

/**
 * Framework-agnostic live-stream ad-break controller (Twitch-style mid-roll).
 *
 * Owns the full phase MACHINE — `idle → playing → exiting → idle` — plus the ad media metadata,
 * progress, skip availability/countdown and the exit timer. The live stream keeps playing (muted)
 * behind the ad and returns to the live edge afterwards. All stream/ad I/O (muting, force-replay,
 * native-pause suppression, releasing the ad element, opening the CTA URL) flows through the
 * injected `LiveAdAdapter`, so the machine lives once for every skin.
 *
 * The skin subscribes to `stateChange` for a reactive snapshot and drives the ad element's
 * `timeupdate`/`ended` into `updateProgress`/`adEnded`.
 */
export class LiveAdController extends EventEmitter<LiveAdControllerEvents & Record<string, (...args: any[]) => void>> {
  private adapter: LiveAdAdapter;
  private _phase: LiveAdPhase = PHASE_IDLE;
  private _config: LiveAdConfig | null = null;
  private _wasMuted = false;
  private _currentTime = 0;
  private _duration = 0;
  private _exitTimer: ReturnType<typeof setTimeout> | null = null;
  private _suppressCleanup: (() => void) | null = null;
  private _destroyed = false;

  constructor(adapter: LiveAdAdapter) {
    super();
    this.adapter = adapter;
  }

  // ─── Public Getters ───────────────────────────────────────

  get phase(): LiveAdPhase {
    return this._phase;
  }

  get state(): LiveAdState {
    const skipAfter = this._config?.skipAfter ?? 0;
    // During the EXITING phase (fade-out after skip/end), keep `canSkip` true so the button
    // text stays "Skip Ad" while fading — not "Skip in 0s" (which flashes when canSkip=false
    // with skipCountdown=0). The user already dismissed the ad; the label shouldn't regress.
    const canSkip =
      (this._phase === PHASE_PLAYING && skipAfter > 0 && this._currentTime >= skipAfter) ||
      this._phase === PHASE_EXITING;
    const skipCountdown =
      this._phase === PHASE_PLAYING && skipAfter > 0 ? Math.max(0, Math.ceil(skipAfter - this._currentTime)) : 0;
    return {
      phase: this._phase,
      isActive: this._phase !== PHASE_IDLE,
      isExiting: this._phase === PHASE_EXITING,
      url: this._config?.url ?? '',
      title: this._config?.title ?? '',
      buttonText: this._config?.buttonText ?? '',
      currentTime: this._currentTime,
      duration: this._duration,
      canSkip,
      skipCountdown,
    };
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Trigger an ad break. Ignored without a URL or when an ad/exit is already in progress. Mutes
   * the live stream (remembering its previous muted state), starts pause-suppression, and enters
   * the `playing` phase.
   */
  triggerAd(config: LiveAdConfig): void {
    if (this._destroyed) return;
    if (!config || !config.url) return;
    if (this._phase !== PHASE_IDLE) return;

    this._config = config;
    this._wasMuted = this.adapter.muteStream();
    this._suppressCleanup = this.adapter.suppressStreamPause();
    this._currentTime = 0;
    this._duration = 0;
    this._phase = PHASE_PLAYING;
    this._emit();

    config.onStart?.();
  }

  /** Update ad progress from the ad element's timeupdate. */
  updateProgress(currentTime: number, duration: number): void {
    if (this._destroyed || this._phase !== PHASE_PLAYING) return;
    this._currentTime = currentTime;
    this._duration = duration || 0;
    this._emit();
  }

  /** The ad finished naturally — fire `onComplete` and begin the exit. */
  adEnded(): void {
    if (this._destroyed) return;
    this._config?.onComplete?.();
    this._beginExit();
  }

  /** Skip the ad — fire `onSkip` and begin the exit (only while playing). */
  skipAd(): void {
    if (this._destroyed || this._phase !== PHASE_PLAYING) return;
    this._config?.onSkip?.();
    this._beginExit();
  }

  /** Click the CTA — open the click-through URL (if any) and fire `onClick`. */
  clickAd(): void {
    if (this._destroyed) return;
    const config = this._config;
    if (config?.clickUrl) {
      this.adapter.openUrl(config.clickUrl);
    }
    config?.onClick?.();
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Destroy controller — cancel the exit timer, stop pause-suppression, and if an ad was active,
   * restore the stream audio. Removes all listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._exitTimer) {
      clearTimeout(this._exitTimer);
      this._exitTimer = null;
    }
    if (this._suppressCleanup) {
      this._suppressCleanup();
      this._suppressCleanup = null;
    }
    if (this._phase !== PHASE_IDLE) {
      this.adapter.restoreStream(this._wasMuted);
      this.adapter.releaseAd();
    }
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  /** Enter the exit phase and schedule the stream restoration. Idempotent (won't stack timers). */
  private _beginExit(): void {
    if (this._exitTimer) return;
    this._phase = PHASE_EXITING;
    this._emit();
    this._exitTimer = setTimeout(() => {
      this._exitTimer = null;
      this._restore();
    }, EXIT_DURATION_MS);
  }

  /** Restore the stream + release the ad, then return to idle. */
  private _restore(): void {
    if (this._suppressCleanup) {
      this._suppressCleanup();
      this._suppressCleanup = null;
    }
    this.adapter.restoreStream(this._wasMuted);
    this.adapter.releaseAd();
    this._phase = PHASE_IDLE;
    this._currentTime = 0;
    this._duration = 0;
    this._config = null;
    this._emit();
  }

  private _emit(): void {
    this.emit('stateChange', this.state);
  }
}
