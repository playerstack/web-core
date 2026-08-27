import { EventEmitter } from '@event-emitter';
import { computeDVRFromRange, sliderPositionToTime, formatLiveOffset, liveEdgeSeekTarget } from '@live-dvr';
import type { LiveDVRState } from '@typings/live-dvr.types';
import type { DVRAdapter } from '@typings/adapters.types';
import type { LiveDVRControllerEvents } from '@typings/live-dvr-controller.types';

export type { LiveDVRControllerEvents } from '@typings/live-dvr-controller.types';
export type { DVRAdapter } from '@typings/adapters.types';

/**
 * Framework-agnostic live DVR (time-shifting) controller.
 *
 * Computes DVR state from adapter data, detects live edge position,
 * and provides seek actions (seekToLive, seekToDVRPosition).
 * Emits `dvrStateChange` on every time update.
 *
 * All platform I/O flows through the injected DVRAdapter.
 */
export class LiveDVRController extends EventEmitter<
  LiveDVRControllerEvents & Record<string, (...args: any[]) => void>
> {
  private adapter: DVRAdapter;
  private _state: LiveDVRState | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _destroyed = false;

  constructor(adapter: DVRAdapter) {
    super();
    this.adapter = adapter;
    this._unsubscribe = adapter.onTimeUpdate(() => this._update());
    this._update(); // initial computation
  }

  // ─── Public Getters ───────────────────────────────────────

  get state(): LiveDVRState | null {
    return this._state;
  }

  get isAtLiveEdge(): boolean {
    return this._state?.isAtLiveEdge ?? true;
  }

  get liveOffset(): string {
    return this._state ? formatLiveOffset(this._state.liveEdgeOffset, this._state.isAtLiveEdge) : '';
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Seek to the live edge (end of seekable range).
   *
   * Lands just BEFORE the absolute seekable end (`end - 1`, clamped to `start`) rather than on
   * it: for VOD-as-live streams seeking exactly to `seekable.end` fires an `ended` event and
   * leaves the element paused. Capping at `end - 1` means "go live" never accidentally stops
   * playback while still landing inside the live-edge tolerance.
   */
  seekToLive(): void {
    if (this._destroyed) return;
    const range = this.adapter.getSeekableRange();
    // Land a few seconds behind the edge (`LIVE_EDGE_SEEK_MARGIN`), not on `end - 1`: the live
    // window keeps advancing in segment steps, so a 1s cushion is immediately swallowed and the
    // offset drifts until it flips to the grey "behind live" dot. The margin keeps playback
    // comfortably inside the at-edge band (and avoids `ended` on VOD-as-live).
    if (range) this.adapter.seekTo(liveEdgeSeekTarget(range.start, range.end));
  }

  /**
   * Seek to a position within the DVR window.
   * @param sliderPos - Position in 0..sliderDuration range.
   *
   * The resolved absolute time is capped at `seekableEnd - 1` (clamped to `seekableStart`) so
   * dragging to the very end of the DVR window means "go live" and never lands on the absolute
   * seekable end — which, for VOD-as-live, would fire `ended` and pause the element.
   */
  seekToDVRPosition(sliderPos: number): void {
    if (this._destroyed) return;
    if (!this._state || !this._state.hasDVR) return;
    const time = sliderPositionToTime(sliderPos, this._state.seekableStart);
    // Dragging to the very end means "go live": cap at the same margin-behind-edge target as
    // `seekToLive` so the position stays live-stable (and never lands on the absolute end, which
    // would fire `ended` on VOD-as-live).
    const liveTarget = liveEdgeSeekTarget(this._state.seekableStart, this._state.seekableEnd);
    const safeTime = Math.min(time, liveTarget);
    this.adapter.seekTo(safeTime);
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Destroy controller — unsubscribe from adapter and remove listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  /** The "no usable DVR" state — a structured object (not null) so every skin reads a stable shape. */
  private _emptyState(seekableStart = 0, seekableEnd = 0): LiveDVRState {
    return {
      hasDVR: false,
      seekableStart,
      seekableEnd,
      seekableWindow: seekableEnd - seekableStart,
      isAtLiveEdge: true,
      liveEdgeOffset: 0,
      sliderDuration: 0,
      sliderPosition: 0,
    };
  }

  private _update(): void {
    if (this._destroyed) return;

    const range = this.adapter.getSeekableRange();
    if (!range) {
      this._setState(this._emptyState());
      return;
    }

    // Reuse the shared pure DVR math (single source of truth with `computeLiveDVRState`), and
    // feed the PREVIOUS at-edge flag so edge detection applies hysteresis and does not flip as
    // the live window advances in segment steps.
    const previousAtEdge = this._state?.isAtLiveEdge ?? true;
    const state = computeDVRFromRange(range.start, range.end, this.adapter.getCurrentTime(), {}, previousAtEdge);
    this._setState(state);
  }

  private _setState(state: LiveDVRState | null): void {
    this._state = state;
    this.emit('dvrStateChange', state);
  }
}
