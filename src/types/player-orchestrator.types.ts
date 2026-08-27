/**
 * Configuration for PlayerOrchestrator constructor.
 */
export interface PlayerOrchestratorConfig {
  /** Interval in ms for progress polling. Default: 1000. */
  progressInterval?: number;
  /** Whether to call engine.destroy() when orchestrator is destroyed. Default: true. */
  stopOnDestroy?: boolean;
  /**
   * Whether the stream is a live broadcast. When set (alone or with `liveDVR`), the orchestrator
   * seeks to the live edge on the FIRST play so playback starts synced to the broadcast's current
   * moment (native HLS / DASH, where hls.js's own `startPosition: -1` does not apply).
   */
  live?: boolean;
  /** Whether the live stream is time-shiftable (DVR). Also triggers the first-play live-edge seek. */
  liveDVR?: boolean;
  /**
   * What to do when the browser's autoplay policy blocks play-WITH-SOUND on first load (no user
   * gesture yet). Browsers can NEVER be forced to allow sound without a gesture, so this chooses
   * the recovery UX:
   *   - `'muted'` (default): mute and retry so the stream keeps playing muted behind a
   *     "click to unmute" tip (YouTube/Twitch default). Sound comes back on the first click.
   *   - `'pause'`: do NOT mute — leave the stream paused and let the skin surface the big play
   *     button. The user's first click then plays WITH SOUND from the start (for consumers who
   *     require audio-on and prefer a click over silent playback).
   */
  autoplayFallback?: 'muted' | 'pause';
}

/**
 * Typed event map for PlayerOrchestrator.
 */
export interface PlayerOrchestratorEvents {
  progress: (data: {
    played: number;
    loaded: number;
    playedSeconds: number;
    loadedSeconds: number;
    bufferedRanges: Array<{ start: number; end: number }>;
  }) => void;
  duration: (duration: number) => void;
  ready: () => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  error: (error: unknown) => void;
  seek: (time: number) => void;
  loading: (isLoading: boolean) => void;
  /**
   * Forwarded from MediaEngine: a live stream transitioned to VOD (gained a
   * fixed duration / `#EXT-X-ENDLIST`). Skins should drop their live/DVR UI and
   * render the standard on-demand timeline.
   */
  liveEnded: () => void;
  /**
   * Autoplay-with-sound was blocked and `autoplayFallback` is `'muted'`: the orchestrator muted
   * the stream and retried play (so live keeps playing muted). Skins should mirror the muted state
   * and surface a "click to unmute" tip; the video is playing, just muted.
   */
  autoplayMuted: () => void;
  /**
   * Autoplay-with-sound was blocked and `autoplayFallback` is `'pause'`: the orchestrator left the
   * stream paused (NOT muted). Skins should mirror the paused state and surface the big play
   * button; the user's first click plays WITH SOUND.
   */
  autoplayPaused: () => void;
}
