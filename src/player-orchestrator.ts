import { EventEmitter } from '@event-emitter';
import type { MediaEngine } from '@media-engine';
import { LIVE_EDGE_SEEK_MARGIN } from '@live-dvr';
import type { PlayerOrchestratorConfig, PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';

export type { PlayerOrchestratorConfig, PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_PROGRESS_INTERVAL = 1000;
const SEEK_ON_PLAY_EXPIRY = 5000;
const DURATION_CHECK_INTERVAL = 100;
const DURATION_CHECK_MAX_RETRIES = 10;

// ─── Class ──────────────────────────────────────────────────────────

/**
 * Framework-agnostic orchestration layer on top of MediaEngine.
 *
 * Manages the coordination between consumer state changes (play/pause/volume/url)
 * and the underlying MediaEngine. Handles progress polling, seek-on-play queuing,
 * duration retry, load deferral, and loop behavior.
 *
 * Skin packages (React, Vue, etc.) instantiate this class and sync their
 * reactive state to it via setter methods.
 */
export class PlayerOrchestrator extends EventEmitter<
  PlayerOrchestratorEvents & Record<string, (...args: any[]) => void>
> {
  private engine: MediaEngine;
  private _progressInterval: number;
  private _stopOnDestroy: boolean;
  /** Whether the stream is live (pure or DVR) — drives the one-time start-at-live-edge seek. */
  private _live: boolean;
  /** Recovery strategy when autoplay-with-sound is blocked (`'muted'` default | `'pause'`). */
  private _autoplayFallback: 'muted' | 'pause';
  /** Guards the one-time "sync to live edge on first play" so it never re-seeks after that. */
  private _didSeekToLiveEdge = false;
  /** Guards the one-time autoplay-blocked recovery (auto-mute retry, or pause) so it runs once. */
  private _didAutoplayMute = false;

  // ─── Internal State ───────────────────────────────────────

  private _isReady = false;
  private _isLoading = true;
  private _isPlaying = false;
  private _isBuffering = false;
  private _wantsToPlay = false;
  private _startOnPlay = true;
  private _onDurationCalled = false;
  private _isSwitchingQuality = false;
  private _destroyed = false;
  private _hasLoadedOnce = false;

  // ─── Deferred Operations ──────────────────────────────────

  private _seekOnPlay: number | null = null;
  private _loadOnReady: string | null = null;

  // ─── Timers ───────────────────────────────────────────────

  private _progressTimer: ReturnType<typeof setInterval> | null = null;
  private _durationCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private _seekExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private _volumeTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Change Detection ─────────────────────────────────────

  private _prevPlayed = 0;
  private _prevLoaded: number | null = 0;

  constructor(engine: MediaEngine, config: PlayerOrchestratorConfig = {}) {
    super();
    this.engine = engine;
    this._progressInterval = config.progressInterval ?? DEFAULT_PROGRESS_INTERVAL;
    this._stopOnDestroy = config.stopOnDestroy ?? true;
    this._live = Boolean(config.live) || Boolean(config.liveDVR);
    this._autoplayFallback = config.autoplayFallback === 'pause' ? 'pause' : 'muted';
    this._subscribeToEngine();
  }

  // ─── Public Getters ───────────────────────────────────────

  get isReady(): boolean {
    return this._isReady;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  // ─── Public Setters ───────────────────────────────────────

  setPlaying(playing: boolean): void {
    if (this._destroyed) return;

    this._wantsToPlay = playing;

    if (!this._isReady) return;

    if (playing && !this._isPlaying) {
      this.engine.play();
    } else if (!playing && this._isPlaying) {
      this.engine.pause();
    }
  }

  setVolume(volume: number): void {
    if (this._destroyed || !this._isReady) return;
    this.engine.setVolume(volume);
  }

  setMuted(muted: boolean): void {
    if (this._destroyed || !this._isReady) return;
    if (muted) {
      this.engine.mute();
    } else {
      this.engine.unmute();
      // Set volume on next tick after unmuting to fix timing bugs
      this._clearVolumeTimer();
      this._volumeTimer = setTimeout(() => {
        if (!this._destroyed) {
          this.engine.setVolume(this.engine.getVolume());
        }
        this._volumeTimer = null;
      }, 0);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this._destroyed || !this._isReady) return;
    this.engine.setPlaybackRate(rate);
  }

  setLoop(loop: boolean): void {
    if (this._destroyed) return;
    this.engine.setLoop(loop);
  }

  load(url: string): void {
    if (this._destroyed) return;
    if (!url) return;

    this._stopProgress();

    // Only defer if we've already initiated a load and engine hasn't signaled ready yet.
    // The first load should always go through immediately.
    if (this._hasLoadedOnce && this._isLoading && !this._isReady) {
      // Defer load until player is ready
      this._loadOnReady = url;
      return;
    }

    // If currently playing, remember position for seek-on-play (quality switch scenario)
    if (this._isReady && this._isPlaying) {
      const currentTime = this.engine.getCurrentTime();
      if (currentTime > 0) {
        this._seekOnPlay = currentTime;
      }
      this._isSwitchingQuality = true;
    }

    this._hasLoadedOnce = true;
    this._isLoading = true;
    this._startOnPlay = true;
    this._onDurationCalled = false;
    this._isReady = false;
    this.emit('loading', true);
    this.engine.load(url);
  }

  seekTo(seconds: number, keepPlaying?: boolean): void {
    if (this._destroyed) return;
    if (!isFinite(seconds)) return;

    if (!this._isReady) {
      // Queue seek for when play starts
      if (seconds !== 0) {
        this._seekOnPlay = seconds;
        this._clearSeekExpiry();
        this._seekExpiryTimer = setTimeout(() => {
          this._seekOnPlay = null;
          this._seekExpiryTimer = null;
        }, SEEK_ON_PLAY_EXPIRY);
      }
      return;
    }

    this.engine.seekTo(seconds, keepPlaying);
    this.emit('seek', seconds);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._stopProgress();
    this._clearDurationCheck();
    this._clearSeekExpiry();
    this._clearVolumeTimer();
    this._unsubscribeFromEngine();

    if (this._stopOnDestroy) {
      this.engine.destroy();
    }

    this.removeAllListeners();
  }

  // ─── Engine Event Handlers ────────────────────────────────

  private _handleReady = (): void => {
    if (this._destroyed) return;

    this._isReady = true;
    this._isLoading = false;
    this.emit('ready');
    this.emit('loading', false);

    // Handle deferred load
    if (this._loadOnReady) {
      const url = this._loadOnReady;
      this._loadOnReady = null;
      this.engine.load(url);
    } else if (this._isSwitchingQuality || this._wantsToPlay) {
      // Auto-play after quality switch or when playing was requested before ready
      this.engine.play();
    }

    this._handleDurationCheck();
  };

  private _handlePlay = (): void => {
    if (this._destroyed) return;

    this._isPlaying = true;
    this._isLoading = false;
    this._isBuffering = false;
    this._isSwitchingQuality = false;
    this._wantsToPlay = true;
    this.emit('loading', false);

    if (this._startOnPlay) {
      this._startOnPlay = false;
    }

    this.emit('play');

    // Apply pending seek-on-play
    if (this._seekOnPlay !== null) {
      this.engine.seekTo(this._seekOnPlay);
      this._seekOnPlay = null;
      this._clearSeekExpiry();
    }

    // On the FIRST play of a live/liveDVR stream, sync to the live edge so playback starts at the
    // broadcast's current moment (red/at-edge LIVE badge), not at an arbitrary past position.
    // Native HLS (Safari/iOS) and DASH don't get hls.js's `startPosition: -1`, so this covers
    // them; on hls.js the edge is already the start, so this is a harmless no-op refinement.
    // Runs once (`_didSeekToLiveEdge`) so it never fights the user's later DVR scrubbing.
    if (this._live && !this._didSeekToLiveEdge) {
      this._didSeekToLiveEdge = true;
      this._seekToLiveEdge();
    }

    this._handleDurationCheck();
    this._startProgress();
  };

  private _handlePause = (): void => {
    if (this._destroyed) return;

    this._isPlaying = false;
    this._stopProgress();

    // A pause that coincides with the element having reached its end is a genuine
    // end-of-stream, not a transient buffering pause. Some MSE/live pipelines fire
    // `pause` at the edge without a following `ended`; propagate it as ended so the
    // skin can show the replay state instead of staying stuck as "playing".
    if (this.engine.hasEnded()) {
      this._wantsToPlay = false;
      this.emit('ended');
      return;
    }

    // Only emit pause when user explicitly requested pause via setPlaying(false).
    // _wantsToPlay being true means playback was interrupted by buffering/loading/etc,
    // NOT by user action. Never propagate these transient pauses to the skin.
    if (!this._wantsToPlay) {
      this.emit('pause');
    }
  };

  private _handleEnded = (): void => {
    if (this._destroyed) return;

    // Loop is handled natively by MediaEngine (setLoop sets <video loop>).
    // If browser fires 'ended' it means loop is off.
    this._isPlaying = false;
    this._wantsToPlay = false;
    this._stopProgress();
    this.emit('ended');
  };

  private _handleError = (error: unknown): void => {
    if (this._destroyed) return;

    this._isLoading = false;
    this.emit('loading', false);
    this.emit('error', error);
  };

  /**
   * Browser autoplay policy blocked play-with-sound. Recover per the configured `autoplayFallback`
   * (runs once per stream, guarded by `_didAutoplayMute`):
   *   - `'muted'` (default, YouTube/Twitch): MUTE and retry play (muted autoplay is always
   *     allowed) so the stream keeps playing behind a "click to unmute" tip. Emits `autoplayMuted`.
   *   - `'pause'`: do NOT mute — mark not-playing and emit `autoplayPaused` so the skin shows the
   *     big play button. The user's first click then plays WITH SOUND (the click is the gesture
   *     the browser required).
   */
  private _handleAutoplayBlocked = (): void => {
    if (this._destroyed || this._didAutoplayMute) return;
    if (!this._wantsToPlay) return; // consumer didn't ask to play; nothing to recover.
    this._didAutoplayMute = true;

    if (this._autoplayFallback === 'pause') {
      // Reflect the real paused state: the video is paused (sound was blocked). The skin surfaces
      // the big play button; the first user click replays WITH SOUND.
      this._wantsToPlay = false;
      this._isPlaying = false;
      this.emit('autoplayPaused');
      this.emit('pause');
      return;
    }

    this.engine.mute();
    this.emit('autoplayMuted');
    this.engine.play();
  };

  /**
   * Seek to the live edge on first live play. `engine.getDuration()` returns the seekable END for
   * a live stream (Infinity native duration), so the edge target lands a small margin behind it
   * (`LIVE_EDGE_SEEK_MARGIN`) — the same cushion `LiveDVRController.seekToLive` uses — so playback
   * stays inside the at-edge band and never lands on the absolute end (which fires `ended` on
   * VOD-as-live). No-op when the edge is not known yet (duration 0).
   */
  private _seekToLiveEdge = (): void => {
    const edge = this.engine.getDuration();
    if (!isFinite(edge) || edge <= 0) return;
    this.engine.seekTo(Math.max(0, edge - LIVE_EDGE_SEEK_MARGIN));
  };

  // ─── Progress Polling ─────────────────────────────────────

  private _startProgress(): void {
    this._stopProgress();
    this._progressTimer = setInterval(() => {
      if (this._destroyed || !this._isPlaying) return;

      const currentTime = this.engine.getCurrentTime();
      const loaded = this.engine.getSecondsLoaded();
      const duration = this.engine.getDuration();

      if (duration > 0) {
        const played = currentTime / duration;
        const loadedRatio = loaded / duration;

        if (currentTime !== this._prevPlayed || loaded !== this._prevLoaded) {
          this.emit('progress', {
            played,
            loaded: loadedRatio,
            playedSeconds: currentTime,
            loadedSeconds: loaded,
            bufferedRanges: this.engine.getBufferedRanges(),
          });
          this._prevPlayed = currentTime;
          this._prevLoaded = loaded;
        }
      }
    }, this._progressInterval);
  }

  private _stopProgress(): void {
    if (this._progressTimer !== null) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  // ─── Duration Check Retry ─────────────────────────────────

  private _handleDurationCheck(): void {
    this._clearDurationCheck();
    let retries = 0;

    const check = (): void => {
      if (this._destroyed) return;

      const duration = this.engine.getDuration();
      if (duration > 0) {
        if (!this._onDurationCalled) {
          this._onDurationCalled = true;
          this.emit('duration', duration);
        }
      } else if (retries < DURATION_CHECK_MAX_RETRIES) {
        retries++;
        this._durationCheckTimer = setTimeout(check, DURATION_CHECK_INTERVAL);
      }
    };

    check();
  }

  // ─── Engine Subscription ──────────────────────────────────

  private _handleBuffer = (): void => {
    if (this._destroyed) return;
    this._isBuffering = true;
  };

  private _handleBufferEnd = (): void => {
    if (this._destroyed) return;
    this._isBuffering = false;
    // If we want to play but aren't (browser paused due to buffer underrun),
    // retry play now that buffer has recovered.
    if (this._wantsToPlay && !this._isPlaying && this._isReady) {
      this.engine.play();
    }
  };

  private _handleLiveEnded = (): void => {
    if (this._destroyed) return;
    this.emit('liveEnded');
  };

  private _handleNativeProgress = (): void => {
    if (this._destroyed) return;
    // Emit buffered ranges update even when not playing (e.g., during seek or pause)
    // This ensures the multi-range buffer bar stays up to date
    const duration = this.engine.getDuration();
    if (duration > 0) {
      const currentTime = this.engine.getCurrentTime();
      const loaded = this.engine.getSecondsLoaded();
      const played = currentTime / duration;
      const loadedRatio = loaded / duration;
      this.emit('progress', {
        played,
        loaded: loadedRatio,
        playedSeconds: currentTime,
        loadedSeconds: loaded,
        bufferedRanges: this.engine.getBufferedRanges(),
      });
    }
  };

  private _subscribeToEngine(): void {
    this.engine.on('ready', this._handleReady);
    this.engine.on('play', this._handlePlay);
    this.engine.on('pause', this._handlePause);
    this.engine.on('ended', this._handleEnded);
    this.engine.on('error', this._handleError);
    this.engine.on('buffer', this._handleBuffer);
    this.engine.on('bufferEnd', this._handleBufferEnd);
    this.engine.on('progress', this._handleNativeProgress);
    this.engine.on('liveEnded', this._handleLiveEnded);
    this.engine.on('autoplayBlocked', this._handleAutoplayBlocked);
  }

  private _unsubscribeFromEngine(): void {
    this.engine.off('ready', this._handleReady);
    this.engine.off('play', this._handlePlay);
    this.engine.off('pause', this._handlePause);
    this.engine.off('ended', this._handleEnded);
    this.engine.off('error', this._handleError);
    this.engine.off('buffer', this._handleBuffer);
    this.engine.off('bufferEnd', this._handleBufferEnd);
    this.engine.off('progress', this._handleNativeProgress);
    this.engine.off('liveEnded', this._handleLiveEnded);
    this.engine.off('autoplayBlocked', this._handleAutoplayBlocked);
  }

  // ─── Timer Helpers ────────────────────────────────────────

  private _clearDurationCheck(): void {
    if (this._durationCheckTimer !== null) {
      clearTimeout(this._durationCheckTimer);
      this._durationCheckTimer = null;
    }
  }

  private _clearSeekExpiry(): void {
    if (this._seekExpiryTimer !== null) {
      clearTimeout(this._seekExpiryTimer);
      this._seekExpiryTimer = null;
    }
  }

  private _clearVolumeTimer(): void {
    if (this._volumeTimer !== null) {
      clearTimeout(this._volumeTimer);
      this._volumeTimer = null;
    }
  }
}
