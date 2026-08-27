/**
 * A single media source with resolution metadata.
 */
export interface MediaSource {
  src: string;
  resolution: string;
  [key: string]: unknown;
}

/**
 * Configuration for the media engine.
 */
export interface MediaEngineConfig {
  /** HLS.js version to load from CDN */
  hlsVersion?: string;
  /** Options passed to HLS.js constructor */
  hlsOptions?: Record<string, unknown>;
  /** DASH.js version to load from CDN */
  dashVersion?: string;
  /** FLV.js version to load from CDN */
  flvVersion?: string;
  /** Force HLS.js usage regardless of extension */
  forceHLS?: boolean;
  /** Force HLS.js usage on Safari (normally uses native HLS) */
  forceSafariHLS?: boolean;
  /** Force disable HLS.js (use native if available) */
  forceDisableHls?: boolean;
  /** Force DASH.js usage regardless of extension */
  forceDASH?: boolean;
  /** Force FLV.js usage regardless of extension */
  forceFLV?: boolean;
  /** Whether the stream is a live broadcast (enables optimized buffer management) */
  live?: boolean;
  /**
   * Whether the live stream is time-shiftable (DVR). When true the HLS back-buffer is NOT
   * trimmed to the small pure-live window, so the viewer can actually PLAY the past (seeking
   * behind live keeps advancing instead of stalling on an evicted back-buffer).
   */
  liveDVR?: boolean;
  /** Additional attributes applied to the media element */
  attributes?: Record<string, string | boolean>;
  /** Track elements configuration */
  tracks?: TrackConfig[];
}

/**
 * Track element configuration (subtitles, captions, etc.)
 */
export interface TrackConfig {
  kind?: string;
  src?: string;
  srcLang?: string;
  label?: string;
  default?: boolean;
  [key: string]: unknown;
}

/**
 * Events emitted by the MediaEngine.
 */
export interface MediaEngineEvents {
  ready: () => void;
  play: (event: { hasAudio: boolean }) => void;
  pause: () => void;
  ended: () => void;
  buffer: () => void;
  bufferEnd: () => void;
  seek: (currentTime: number) => void;
  /**
   * Fired when a live stream transitions to VOD (its playlist gained an end
   * boundary — e.g. HLS `#EXT-X-ENDLIST`). After this the content behaves like a
   * normal on-demand asset with a fixed duration.
   */
  liveEnded: () => void;
  /**
   * Fired when `play()` was rejected by the browser's autoplay policy (`NotAllowedError`) — i.e.
   * autoplay-with-sound was blocked with no user gesture. The orchestrator recovers by starting
   * muted (allowed without a gesture) so live playback continues behind a "click to unmute" tip.
   */
  autoplayBlocked: () => void;
  error: (error: unknown, data?: unknown, instance?: unknown, sdk?: unknown) => void;
  playbackRateChange: (rate: number) => void;
  enablePiP: () => void;
  disablePiP: () => void;
  loaded: () => void;
  durationChange: (duration: number) => void;
  timeUpdate: (currentTime: number) => void;
  volumeChange: (volume: number, muted: boolean) => void;
  progress: (loaded: number) => void;
}

/**
 * State snapshot of the media engine at any point.
 */
export interface MediaState {
  playing: boolean;
  paused: boolean;
  ended: boolean;
  buffering: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  loaded: number;
  loop: boolean;
  pip: boolean;
}

/**
 * Typed event emitter interface for media events.
 */
export type MediaEventHandler<K extends keyof MediaEngineEvents> = MediaEngineEvents[K];
