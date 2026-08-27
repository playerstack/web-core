import { EventEmitter } from '@event-emitter';
import type { VolumeAdapter } from '@typings/adapters.types';
import type { VolumeControllerEvents } from '@typings/volume-controller.types';

export type { VolumeControllerEvents } from '@typings/volume-controller.types';
export type { VolumeAdapter } from '@typings/adapters.types';

const IGNORE_GUARD_DURATION = 50;

/**
 * Framework-agnostic volume controller.
 *
 * Manages mute-memory (remembers volume before mute, restores on unmute)
 * and an "ignore own changes" guard to prevent feedback loops when
 * programmatic changes fire the adapter's onVolumeChange callback.
 *
 * All platform I/O flows through the injected VolumeAdapter.
 */
export class VolumeController extends EventEmitter<VolumeControllerEvents & Record<string, (...args: any[]) => void>> {
  private adapter: VolumeAdapter;
  private _volumeBeforeMute = 0.8;
  private _ignoreOwnChange = false;
  private _ignoreTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _destroyed = false;

  constructor(adapter: VolumeAdapter) {
    super();
    this.adapter = adapter;
    this._unsubscribe = adapter.onVolumeChange((volume, muted) => {
      if (this._ignoreOwnChange) return;
      const effectiveMuted = muted || volume === 0;
      this.emit('volumeChange', { volume, muted: effectiveMuted });
    });
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Toggle mute. Remembers volume before muting and restores on unmute.
   */
  onMutedClick(): void {
    if (this._destroyed) return;
    const willMute = !this.adapter.getMuted();
    this._setIgnoreGuard();

    if (willMute) {
      const currentVol = this.adapter.getVolume();
      if (currentVol > 0) this._volumeBeforeMute = currentVol;
      this.adapter.setMuted(true);
      this.emit('volumeChange', { volume: currentVol, muted: true });
    } else {
      const restored = this._volumeBeforeMute || 0.8;
      this.adapter.setMuted(false);
      this.adapter.setVolume(restored);
      this.emit('volumeChange', { volume: restored, muted: false });
    }
  }

  /**
   * Mirror an EXTERNAL muted value onto the adapter (e.g. a `muted` prop the skin controls),
   * engaging the ignore-guard so the resulting `onVolumeChange` echo does not feed back as a
   * `volumeChange` event. No event is emitted: this reflects a truth the caller already holds.
   */
  syncMuted(muted: boolean): void {
    if (this._destroyed) return;
    this._setIgnoreGuard();
    this.adapter.setMuted(muted);
  }

  /**
   * Change volume to a specific value (0–1).
   * If volume > 0 and currently muted, also unmutes.
   */
  changeVolume(v: number): void {
    if (this._destroyed) return;
    this._setIgnoreGuard();
    this.adapter.setVolume(v);

    const isMuted = v === 0;
    if (v !== 0 && this.adapter.getMuted()) {
      this.adapter.setMuted(false);
    }

    if (v > 0) this._volumeBeforeMute = v;
    this.emit('volumeChange', { volume: v, muted: isMuted });
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Destroy controller — unsubscribe from adapter and clear timers.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
    if (this._ignoreTimer) clearTimeout(this._ignoreTimer);
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────

  private _setIgnoreGuard(): void {
    this._ignoreOwnChange = true;
    if (this._ignoreTimer) clearTimeout(this._ignoreTimer);
    this._ignoreTimer = setTimeout(() => {
      this._ignoreOwnChange = false;
      this._ignoreTimer = null;
    }, IGNORE_GUARD_DURATION);
  }
}
