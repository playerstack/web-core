import { EventEmitter } from '@event-emitter';
import { getSDK } from '@utils/sdk';
import { isMediaStream, hasAudio, supportsWebKitPresentationMode } from '@utils/media';
import { HLS_EXTENSIONS, DASH_EXTENSIONS, FLV_EXTENSIONS } from '@patterns';
import {
  IS_IOS,
  IS_SAFARI,
  IS_MMS_SUPPORTED,
  HLS_SDK_URL,
  HLS_GLOBAL,
  DASH_SDK_URL,
  DASH_GLOBAL,
  FLV_SDK_URL,
  FLV_GLOBAL,
  DEFAULT_HLS_VERSION,
  DEFAULT_DASH_VERSION,
  DEFAULT_FLV_VERSION,
} from '@constants';
import type { MediaEngineConfig, MediaEngineEvents, MediaState } from '@typings/media.types';

/**
 * Framework-agnostic media engine.
 *
 * Manages a native HTMLMediaElement, loading external SDKs (HLS.js, DASH.js, FLV.js)
 * as needed, and exposes a uniform playback API with typed events.
 *
 * Usage:
 * ```ts
 * const video = document.querySelector('video');
 * const engine = new MediaEngine(video, { hlsVersion: '1.5.7' });
 * engine.on('ready', () => console.log('ready'));
 * engine.load('https://example.com/stream.m3u8');
 * ```
 */
export class MediaEngine extends EventEmitter<MediaEngineEvents & Record<string, (...args: any[]) => void>> {
  private el: HTMLMediaElement;
  private config: Required<Pick<MediaEngineConfig, 'hlsVersion' | 'dashVersion' | 'flvVersion'>> & MediaEngineConfig;
  private hls: any = null;
  private dash: any = null;
  private flv: any = null;
  private loadSequence = 0;
  private listenersAttached = false;
  private _destroyed = false;
  private _liveEndedEmitted = false;
  private _sawInfiniteDuration = false;

  constructor(element: HTMLMediaElement, config: MediaEngineConfig = {}) {
    super();
    this.el = element;
    this.config = {
      hlsVersion: DEFAULT_HLS_VERSION,
      dashVersion: DEFAULT_DASH_VERSION,
      flvVersion: DEFAULT_FLV_VERSION,
      ...config,
    };
    this.attachListeners();
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Load a media source URL. Automatically selects the correct SDK.
   */
  load(url: string | MediaStream): void {
    if (this._destroyed) return;

    this.destroySDKs();
    this.loadSequence++;
    this._liveEndedEmitted = false;
    this._sawInfiniteDuration = false;
    const currentSequence = this.loadSequence;

    const urlStr = typeof url === 'string' ? url : '';

    if (this.shouldUseHLS(urlStr)) {
      this.loadHLS(urlStr, currentSequence);
    } else if (this.shouldUseDASH(urlStr)) {
      this.loadDASH(urlStr, currentSequence);
    } else if (this.shouldUseFLV(urlStr)) {
      this.loadFLV(urlStr, currentSequence);
    } else if (isMediaStream(url)) {
      try {
        this.el.srcObject = url;
      } catch {
        this.el.src = URL.createObjectURL(url as any);
      }
    } else {
      this.el.src = urlStr;
      if (IS_IOS || this.config.forceDisableHls) {
        this.el.load();
      }
    }
  }

  play(): Promise<void> | void {
    const promise = this.el.play();
    if (promise) {
      return promise.catch((err) => {
        // A `NotAllowedError` means the browser's autoplay policy blocked playback WITH SOUND
        // (no user gesture yet). This is not a media error: emit `autoplayBlocked` so the
        // orchestrator can recover by starting muted (the policy allows muted autoplay), which
        // keeps a live stream playing behind a "click to unmute" tip instead of sitting paused.
        if (err?.name === 'NotAllowedError') {
          this.emit('autoplayBlocked');
          return;
        }
        // `AbortError` is a transient interruption (e.g. a load/seek raced the play) — ignore it;
        // the orchestrator retries play via the `_wantsToPlay` mechanism. Anything else is a real
        // media error.
        if (err?.name !== 'AbortError') {
          this.emit('error', err);
        }
      });
    }
  }

  pause(): void {
    this.el.pause();
  }

  stop(): void {
    this.el.removeAttribute('src');
    this.el.srcObject = null;
    this.destroySDKs();
  }

  seekTo(seconds: number, keepPlaying = true): void {
    this.el.currentTime = seconds;
    if (!keepPlaying) {
      this.pause();
    }
  }

  setVolume(fraction: number): void {
    this.el.volume = Math.max(0, Math.min(1, fraction));
  }

  getVolume(): number {
    return this.el.volume;
  }

  mute(): void {
    this.el.muted = true;
  }

  unmute(): void {
    this.el.muted = false;
  }

  isMuted(): boolean {
    return this.el.muted;
  }

  /**
   * Whether the underlying element has reached its end.
   * Used to disambiguate a genuine end-of-stream from a transient
   * buffering pause (which the orchestrator otherwise swallows).
   */
  hasEnded(): boolean {
    return this.el.ended;
  }

  setPlaybackRate(rate: number): void {
    try {
      this.el.playbackRate = rate;
    } catch (error) {
      this.emit('error', error);
    }
  }

  getPlaybackRate(): number {
    return this.el.playbackRate;
  }

  setLoop(loop: boolean): void {
    this.el.loop = loop;
  }

  getDuration(): number {
    const { duration, seekable } = this.el;
    if (duration === Infinity && seekable.length > 0) {
      return seekable.end(seekable.length - 1);
    }
    return duration || 0;
  }

  getCurrentTime(): number {
    return this.el.currentTime;
  }

  getSecondsLoaded(): number {
    const { buffered } = this.el;
    if (buffered.length === 0) return 0;
    const end = buffered.end(buffered.length - 1);
    const duration = this.getDuration();
    if (duration && end > duration) return duration;
    return end;
  }

  /**
   * Get all buffered time ranges as an array.
   * Used for multi-range buffer visualization (YouTube-style).
   */
  getBufferedRanges(): Array<{ start: number; end: number }> {
    const { buffered } = this.el;
    const ranges: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < buffered.length; i++) {
      ranges.push({ start: buffered.start(i), end: buffered.end(i) });
    }
    return ranges;
  }

  enablePiP(): void {
    const video = this.el as HTMLVideoElement;
    if (video.requestPictureInPicture && document.pictureInPictureElement !== video) {
      const promise = video.requestPictureInPicture();
      if (promise?.catch) {
        promise.catch((err) => this.emit('error', err));
      }
    } else if (
      supportsWebKitPresentationMode(video) &&
      (video as any).webkitPresentationMode !== 'picture-in-picture'
    ) {
      (video as any).webkitSetPresentationMode('picture-in-picture');
    }
  }

  disablePiP(): void {
    const video = this.el as HTMLVideoElement;
    if (document.exitPictureInPicture && document.pictureInPictureElement === video) {
      document.exitPictureInPicture();
    } else if (supportsWebKitPresentationMode(video) && (video as any).webkitPresentationMode !== 'inline') {
      (video as any).webkitSetPresentationMode('inline');
    }
  }

  /**
   * Get a snapshot of the current media state.
   */
  getState(): MediaState {
    return {
      playing: !this.el.paused && !this.el.ended,
      paused: this.el.paused,
      ended: this.el.ended,
      buffering: this.el.readyState < 3,
      duration: this.getDuration(),
      currentTime: this.getCurrentTime(),
      volume: this.getVolume(),
      muted: this.isMuted(),
      playbackRate: this.getPlaybackRate(),
      loaded: this.getSecondsLoaded(),
      loop: this.el.loop,
      pip: document.pictureInPictureElement === this.el,
    };
  }

  /**
   * Get the underlying media element.
   */
  getElement(): HTMLMediaElement {
    return this.el;
  }

  /**
   * Get the HLS.js instance (if active).
   */
  getHlsInstance(): unknown {
    return this.hls;
  }

  /**
   * Get the DASH.js instance (if active).
   */
  getDashInstance(): unknown {
    return this.dash;
  }

  /**
   * Destroy the engine, removing all listeners and SDK instances.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this.detachListeners();
    this.removeAllListeners();
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private shouldUseHLS(url: string): boolean {
    if ((IS_SAFARI && this.config.forceSafariHLS) || this.config.forceHLS) {
      return true;
    }
    if (this.config.forceDisableHls) {
      return false;
    }
    if (IS_IOS) {
      // iOS historically forced native HLS because iPhone Safari had no MSE, so hls.js
      // could not run. Since iOS 17.1 (Nov 2023) Apple ships ManagedMediaSource, which
      // lets hls.js build its own buffer and expose a real seekable window — this is what
      // enables live-DVR seek-back on iPhone (native HLS pins to the live edge and never
      // exposes a seekable DVR range). So on iOS use hls.js ONLY when an MSE-class API is
      // present; otherwise (iOS < 17.1) fall back to native HLS.
      return HLS_EXTENSIONS.test(url) && IS_MMS_SUPPORTED;
    }
    return HLS_EXTENSIONS.test(url);
  }

  private shouldUseDASH(url: string): boolean {
    return DASH_EXTENSIONS.test(url) || !!this.config.forceDASH;
  }

  private shouldUseFLV(url: string): boolean {
    return FLV_EXTENSIONS.test(url) || !!this.config.forceFLV;
  }

  private loadHLS(url: string, sequence: number): void {
    getSDK(HLS_SDK_URL.replace('VERSION', this.config.hlsVersion), HLS_GLOBAL)
      .then((Hls: any) => {
        if (sequence !== this.loadSequence || this._destroyed) return;

        // Buffer management for live. Two profiles:
        //  - Pure live (no DVR): trim aggressively to stay near the edge and avoid SourceBuffer
        //    overflow — a small back-buffer is fine because the viewer never seeks back.
        //  - Live DVR (time-shift): the viewer CAN seek into the past, so the back-buffer must be
        //    retained; a small `backBufferLength` would evict the seeked-to past and freeze
        //    playback (currentTime pinned while the edge advances). Keep a large back-buffer so
        //    the past stays playable. `backBufferLength: Infinity` tells hls.js not to trim it.
        //
        // Both profiles also START AT THE LIVE EDGE: `startPosition: -1` tells hls.js to begin at
        // the live edge instead of its default (which can land seconds behind, showing the grey
        // "behind live" badge on first load). A tight `liveSyncDuration` keeps playback locked to
        // the edge so the LIVE badge starts red/at-edge. Both can be overridden via `hlsOptions`.
        let liveDefaults: Record<string, unknown> = {};
        if (this.config.liveDVR) {
          liveDefaults = {
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            backBufferLength: Infinity,
            startPosition: -1,
            liveSyncDuration: 3,
          };
        } else if (this.config.live) {
          liveDefaults = {
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            backBufferLength: 30,
            startPosition: -1,
            liveSyncDuration: 3,
          };
        }

        // `preferManagedMediaSource: true` lets hls.js pick Apple's ManagedMediaSource on
        // iOS 17.1+ (the only MSE-class API on iPhone Safari). It is the default in recent
        // hls.js but set explicitly so DVR seek-back works on iPhone regardless of version.
        this.hls = new Hls({ preferManagedMediaSource: true, ...liveDefaults, ...(this.config.hlsOptions || {}) });
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.emit('ready');
        });
        // hls.js flips level details to non-live once the playlist gains an
        // `#EXT-X-ENDLIST`. This fires earlier and more reliably than the native
        // durationchange, so treat it as the authoritative live→VOD signal.
        this.hls.on(Hls.Events.LEVEL_UPDATED, (_event: any, data: any) => {
          if (!this._liveEndedEmitted && data?.details && data.details.live === false) {
            this._sawInfiniteDuration = true;
            this._liveEndedEmitted = true;
            this.emit('liveEnded');
          }
        });
        this.hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          this.emit('error', event, data, this.hls, Hls);
        });
        // On iOS, ManagedMediaSource only attaches when the element opts out of remote
        // playback (AirPlay), otherwise Safari keeps the native pipeline and hls.js can't
        // bind its buffer. Harmless on other platforms.
        if (IS_IOS) {
          try {
            (this.el as any).disableRemotePlayback = true;
          } catch {
            /* read-only in some engines — ignore */
          }
        }
        this.hls.loadSource(url);
        this.hls.attachMedia(this.el);
        this.emit('loaded');
      })
      .catch((err) => this.emit('error', err));
  }

  private loadDASH(url: string, sequence: number): void {
    getSDK(DASH_SDK_URL.replace('VERSION', this.config.dashVersion), DASH_GLOBAL)
      .then((dashjs: any) => {
        if (sequence !== this.loadSequence || this._destroyed) return;
        this.dash = dashjs.MediaPlayer().create();
        this.dash.initialize(this.el, url, false);
        this.dash.on('error', (e: any) => {
          this.emit('error', e, null, this.dash, dashjs);
        });
        if (parseInt(this.config.dashVersion) < 3) {
          this.dash.getDebug().setLogToBrowserConsole(false);
        } else {
          this.dash.updateSettings({
            debug: { logLevel: dashjs.LogLevel.LOG_LEVEL_NONE },
            streaming: {
              // Reduce initial buffer target for faster start
              buffer: {
                fastSwitchEnabled: true,
                stableBufferTime: 12,
                bufferTimeAtTopQuality: 20,
                initialBufferLevel: NaN, // use default
              },
              // Use lower latency ABR for faster quality decisions
              abr: {
                autoSwitchBitrate: { video: true, audio: true },
              },
            },
          });
        }
        this.emit('loaded');
      })
      .catch((err) => this.emit('error', err));
  }

  private loadFLV(url: string, sequence: number): void {
    getSDK(FLV_SDK_URL.replace('VERSION', this.config.flvVersion), FLV_GLOBAL)
      .then((flvjs: any) => {
        if (sequence !== this.loadSequence || this._destroyed) return;
        this.flv = flvjs.createPlayer({ type: 'flv', url });
        this.flv.attachMediaElement(this.el);
        this.flv.on(flvjs.Events.ERROR, (e: any, data: any) => {
          this.emit('error', e, data, this.flv, flvjs);
        });
        this.flv.load();
        this.emit('loaded');
      })
      .catch((err) => this.emit('error', err));
  }

  private destroySDKs(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.dash) {
      this.dash.reset();
      this.dash = null;
    }
    if (this.flv) {
      this.flv.unload();
      this.flv.detachMediaElement();
      this.flv.destroy();
      this.flv = null;
    }
  }

  // ─── DOM Event Listeners ──────────────────────────────────────────────

  private onPlay = () => {
    this.emit('play', { hasAudio: hasAudio(this.el as HTMLVideoElement) });
  };
  private onPause = () => this.emit('pause');
  private onEnded = () => this.emit('ended');
  private onBuffer = () => this.emit('buffer');
  private onBufferEnd = () => this.emit('bufferEnd');
  private onSeeked = () => this.emit('seek', this.el.currentTime);
  private onError = (e: Event) => this.emit('error', e);
  private onRateChange = () => this.emit('playbackRateChange', this.el.playbackRate);
  private onCanPlay = () => this.emit('ready');
  private onDurationChange = () => {
    this._detectLiveToVOD();
    this.emit('durationChange', this.getDuration());
  };

  /**
   * Detect a live→VOD transition from the media element itself.
   *
   * A live stream reports `duration === Infinity`. When the source playlist
   * gains an end boundary (HLS `#EXT-X-ENDLIST`), the element's duration flips
   * to a finite value. This is the SDK-agnostic signal used for native HLS and
   * DASH (hls.js also emits an explicit level update, handled separately).
   */
  private _detectLiveToVOD(): void {
    if (this._liveEndedEmitted) return;
    const raw = this.el.duration;
    if (raw === Infinity) {
      this._sawInfiniteDuration = true;
      return;
    }
    // Only treat a finite duration as a transition if we previously observed a
    // live (infinite) duration — a plain VOD asset is not a "live ended" event.
    if (this._sawInfiniteDuration && isFinite(raw) && raw > 0) {
      this._liveEndedEmitted = true;
      this.emit('liveEnded');
    }
  }
  private onTimeUpdate = () => this.emit('timeUpdate', this.el.currentTime);
  private onVolumeChange = () => this.emit('volumeChange', this.el.volume, this.el.muted);
  private onProgress = () => this.emit('progress', this.getSecondsLoaded());
  private onEnterPiP = () => this.emit('enablePiP');
  private onLeavePiP = () => this.emit('disablePiP');
  private onPresentationModeChange = () => {
    const video = this.el as HTMLVideoElement;
    if (supportsWebKitPresentationMode(video)) {
      const mode = (video as any).webkitPresentationMode;
      if (mode === 'picture-in-picture') this.emit('enablePiP');
      else if (mode === 'inline') this.emit('disablePiP');
    }
  };

  private attachListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const el = this.el;
    el.addEventListener('play', this.onPlay);
    el.addEventListener('pause', this.onPause);
    el.addEventListener('ended', this.onEnded);
    el.addEventListener('waiting', this.onBuffer);
    el.addEventListener('playing', this.onBufferEnd);
    el.addEventListener('seeked', this.onSeeked);
    el.addEventListener('error', this.onError);
    el.addEventListener('ratechange', this.onRateChange);
    el.addEventListener('canplay', this.onCanPlay);
    el.addEventListener('durationchange', this.onDurationChange);
    el.addEventListener('timeupdate', this.onTimeUpdate);
    el.addEventListener('volumechange', this.onVolumeChange);
    el.addEventListener('progress', this.onProgress);
    el.addEventListener('enterpictureinpicture', this.onEnterPiP);
    el.addEventListener('leavepictureinpicture', this.onLeavePiP);
    el.addEventListener('webkitpresentationmodechanged', this.onPresentationModeChange);
  }

  private detachListeners(): void {
    if (!this.listenersAttached) return;
    this.listenersAttached = false;

    const el = this.el;
    el.removeEventListener('play', this.onPlay);
    el.removeEventListener('pause', this.onPause);
    el.removeEventListener('ended', this.onEnded);
    el.removeEventListener('waiting', this.onBuffer);
    el.removeEventListener('playing', this.onBufferEnd);
    el.removeEventListener('seeked', this.onSeeked);
    el.removeEventListener('error', this.onError);
    el.removeEventListener('ratechange', this.onRateChange);
    el.removeEventListener('canplay', this.onCanPlay);
    el.removeEventListener('durationchange', this.onDurationChange);
    el.removeEventListener('timeupdate', this.onTimeUpdate);
    el.removeEventListener('volumechange', this.onVolumeChange);
    el.removeEventListener('progress', this.onProgress);
    el.removeEventListener('enterpictureinpicture', this.onEnterPiP);
    el.removeEventListener('leavepictureinpicture', this.onLeavePiP);
    el.removeEventListener('webkitpresentationmodechanged', this.onPresentationModeChange);
  }
}
