// Adapter interfaces for platform-specific implementations (Phase 2)
// Each adapter abstracts platform I/O so the same hook runs on web and React Native.

/**
 * Platform adapter for ad-related interactions.
 * Web implementations block native media session and open URLs in new tabs.
 * React Native implementations may use expo-linking or similar.
 */
export interface AdsPlatform {
  /** Block native media session controls during ad. Returns cleanup function. */
  blockMediaSession?: () => () => void;
  /** Open a URL (e.g., ad click-through) in the platform's browser. */
  openUrl?: (url: string) => void;
}

/**
 * Platform adapter for volume and mute control.
 * Web implementations wrap an HTMLMediaElement; native implementations
 * wrap expo-av or react-native-video.
 */
export interface VolumeAdapter {
  /** Get the current volume (0–1). */
  getVolume(): number;
  /** Set the volume (0–1). */
  setVolume(v: number): void;
  /** Whether the media is currently muted. */
  getMuted(): boolean;
  /** Set the muted state. */
  setMuted(muted: boolean): void;
  /** Subscribe to external volume/mute changes. Returns a cleanup function. */
  onVolumeChange(cb: (volume: number, muted: boolean) => void): () => void;
}

/**
 * Platform adapter for fullscreen control.
 * Web implementations wrap the Fullscreen API (with vendor prefixes) on the player element;
 * native implementations may map to an orientation/immersive-mode toggle.
 */
export interface FullscreenAdapter {
  /** Request fullscreen for the player. */
  request(): void;
  /** Exit fullscreen. */
  exit(): void;
  /** Whether the player is currently fullscreen. */
  isFullscreen(): boolean;
  /** Subscribe to fullscreen changes. Returns a cleanup function. */
  onChange(callback: () => void): () => void;
}

/**
 * Connection state of a cast/remote-playback session.
 * `disconnected` — not casting; `connecting` — session starting; `connected` — casting.
 */
export type CastState = 'disconnected' | 'connecting' | 'connected';

/**
 * Platform adapter for casting / remote playback.
 * Web implementations wrap the Remote Playback API (`video.remote`) with a Presentation API
 * fallback; native implementations may wrap a native cast SDK. The controller orchestrates the
 * "try remote playback, then fall back" strategy; the adapter performs the concrete platform I/O.
 */
export interface CastAdapter {
  /** Whether any cast mechanism is supported on this platform. */
  isSupported(): boolean;
  /** The current cast connection state. */
  getState(): CastState;
  /**
   * Start a cast session. Resolves when a session begins; rejects if the primary mechanism
   * fails so the controller can try the fallback. `usedFallback` (in the resolved value) tells
   * the controller which path succeeded.
   */
  prompt(): Promise<{ usedFallback: boolean }>;
  /** Enable/disable casting (e.g. disabled during ads). */
  setDisabled(disabled: boolean): void;
  /** Watch device availability. Returns a cleanup function. */
  watchAvailability(callback: (available: boolean) => void): () => void;
  /** Subscribe to connection-state changes. Returns a cleanup function. */
  onStateChange(callback: (state: CastState) => void): () => void;
  /** Release any active session/resources. */
  destroy(): void;
}

/**
 * Platform adapter for a live-stream ad break (Twitch-style mid-roll over a muted live stream).
 * Web implementations mute/replay the real `<video>` and suppress its native pause; native
 * implementations wrap the equivalent player controls. The controller owns the phase machine;
 * the adapter performs the concrete stream/ad I/O.
 */
export interface LiveAdAdapter {
  /** Mute the live stream, returning its previous muted state (to restore later). */
  muteStream(): boolean;
  /** Restore the live stream audio to `wasMuted` and force it to keep playing at the live edge. */
  restoreStream(wasMuted: boolean): void;
  /**
   * While the ad is active, suppress native pause on the (occluded/muted) live stream so it keeps
   * running at the live edge. Returns a cleanup that stops suppressing.
   */
  suppressStreamPause(): () => void;
  /** Release the ad media resources (pause + unload the ad element). */
  releaseAd(): void;
  /** Open the ad click-through URL. */
  openUrl(url: string): void;
}

/** Pixel dimensions of a sprite sheet image, keyed by its URL. */
export type SpriteSheetSizes = Record<string, { w: number; h: number }>;

/**
 * Platform adapter for the sprite/thumbnail preview I/O.
 * The frame-selection MATH is the pure core `computeSpriteFrame`; this adapter only performs the
 * platform I/O the preview needs: fetching the VTT text, measuring the sprite sheet image
 * dimensions, and reading the preview container's pixel size. Web implementations use `fetch` +
 * `new Image()` + `offsetWidth/Height`; native implementations use their own loaders.
 */
export interface SpriteAdapter {
  /** Fetch the raw VTT text for the sprite index at `url`. */
  fetchVtt(url: string): Promise<string>;
  /** Measure the natural pixel size of each sprite sheet URL. */
  loadSheetSizes(urls: string[]): Promise<SpriteSheetSizes>;
  /** Current pixel size of the preview container the frame is scaled to cover. */
  getContainerSize(): { width: number; height: number };
}

/**
 * Platform adapter for live DVR (time-shifting) functionality.
 * Web implementations wrap an HTMLMediaElement's seekable/currentTime;
 * native implementations wrap expo-av or react-native-video.
 */
export interface DVRAdapter {
  /** Get the current seekable range, or null if unavailable. */
  getSeekableRange(): { start: number; end: number } | null;
  /** Get the current playback time in seconds. */
  getCurrentTime(): number;
  /** Seek to the given absolute time in seconds. */
  seekTo(time: number): void;
  /** Subscribe to time update events. Returns a cleanup function. */
  onTimeUpdate(callback: () => void): () => void;
}

/**
 * Configuration object for a single ad unit.
 */
export interface AdsConfig {
  /** Seconds before skip becomes available. If undefined, no skip timer. */
  skipAfter?: number;
  /** Called when the user skips the ad. */
  onSkip?: () => void;
  /** Called when the user clicks the ad area. */
  onAdClick?: () => void;
  /** Called when the ad video completes (reaches end). */
  onAdComplete?: () => void;
  /** Click-through URL opened when ad is clicked. Also shown (hostname) in the ad banner. */
  url?: string;
  /** Ad banner title (the advertiser/ad name). Shown in the bottom-left ad banner. */
  title?: string;
  /** Ad banner call-to-action button label (e.g. "Visit site"). */
  buttonText?: string;
  /** Optional ad banner thumbnail/icon URL shown left of the title. */
  icon?: string;
}

/**
 * Platform adapter for player media operations.
 * Web implementations wrap HTMLMediaElement/HTMLAudioElement;
 * native implementations wrap expo-av or react-native-video.
 *
 * This is the comprehensive interface for Phase 3 orchestration hooks.
 */
export interface PlayerAdapter {
  /** Start playback. */
  play(): void;
  /** Pause playback. */
  pause(): void;
  /** Stop and unload media. */
  stop(): void;
  /** Load a media source URL. `isReady` indicates if immediate playback is expected. */
  load(url: string, isReady?: boolean): void;
  /** Seek to an absolute position in seconds. `keepPlaying` preserves play state. */
  seekTo(seconds: number, keepPlaying?: boolean): void;
  /** Set the volume (0–1). */
  setVolume(v: number): void;
  /** Mute the media. */
  mute(): void;
  /** Unmute the media. */
  unmute(): void;
  /** Set the playback rate (1 = normal). */
  setPlaybackRate(rate: number): void;
  /** Get total duration in seconds, or null if unknown. */
  getDuration(): number | null;
  /** Get current playback position in seconds, or null if unavailable. */
  getCurrentTime(): number | null;
  /** Get the number of seconds currently loaded/buffered, or null. */
  getSecondsLoaded(): number | null;
}
