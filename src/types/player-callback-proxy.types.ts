/**
 * Types for the framework-agnostic `createPlayerCallbackProxy` factory.
 *
 * The proxy forwards player-lifecycle events (from a MediaEngine/PlayerOrchestrator or the legacy
 * PlayerProxy) to the consumer's callbacks AND reduces the corresponding playback-state update.
 * It is pure and framework-agnostic: the caller supplies GETTER functions so a framework skin can
 * keep the latest callbacks/state in refs and read them through the getters, achieving a stable
 * proxy identity without core ever importing React.
 */

/** A state reducer update: either a partial patch or a functional updater `(prev) => next`. */
export type PlayerStateUpdate<S = Record<string, unknown>> = Partial<S> | ((prev: S) => S);

/** The consumer's optional lifecycle callbacks forwarded by the proxy (all optional). */
export interface PlayerProxyCallbacks {
  onBuffer?: (...args: unknown[]) => void;
  onBufferEnd?: (...args: unknown[]) => void;
  onDuration?: (duration: number) => void;
  onEnded?: () => void;
  onError?: (error: unknown, data?: unknown, instance?: unknown, sdk?: unknown) => void;
  onPause?: () => void;
  onPlay?: (event?: { hasAudio?: boolean }) => void;
  onPlayBackRateChange?: (rate: number) => void;
  onProgress?: (state: {
    playedSeconds?: number;
    played?: number;
    loaded?: number;
    bufferedRanges?: unknown[];
  }) => void;
  onReady?: () => void;
  onSeek?: (time: number) => void;
  onStart?: (...args: unknown[]) => void;
  onLoaded?: (...args: unknown[]) => void;
  onMount?: (...args: unknown[]) => void;
  // Video-only handlers (forwarded when includePipHandlers / includeQualityHandler are set).
  onEnablePIP?: (event?: unknown) => void;
  onDisablePIP?: (event?: unknown) => void;
  onPlayBackQualityChange?: (quality: number) => void;
}

/** Error `data` shape the proxy inspects to classify recoverable vs fatal errors. */
export interface PlayerErrorData {
  type?: string;
  details?: string;
  error?: { message?: string };
}

/**
 * Config for `createPlayerCallbackProxy`. Every input is a GETTER so the skin can read the latest
 * value from a ref on each proxy invocation (stable proxy identity, always-fresh values).
 */
export interface PlayerCallbackProxyConfig<S = Record<string, unknown>> {
  /** Returns the current consumer callbacks (skin reads from a ref). */
  getCallbacks: () => PlayerProxyCallbacks;
  /** Applies a state update (partial or functional). The skin wires this to its state setter. */
  applyStateUpdate: (update: PlayerStateUpdate<S>) => void;
  /** Returns whether a seek is in progress (progress updates are ignored while seeking). */
  getSeeking: () => boolean;
  /** Returns whether playback is "prevented" (forces `hasAudio` true on play, parity). */
  getPrevented: () => boolean;
  /** Recoverable error `type` values (ignored, no fatal state). */
  recoverableErrorTypes?: readonly string[];
  /** Recoverable `mediaError` `details` values (ignored, no fatal state). */
  recoverableErrorDetails?: readonly string[];
  /**
   * When `true`, `onEnded` also sets `playing: false` alongside `isEnded: true` (audio skin
   * parity — renders the replay/paused state consistently). Defaults to `false` (video skin).
   */
  clearPlayingOnEnded?: boolean;
  /**
   * When `true`, `onProgress` also reduces `bufferedRanges` from `state.bufferedRanges` (audio
   * skin parity, which drives a segmented progress bar). Defaults to `false` (video skin).
   */
  includeBufferedRangesOnProgress?: boolean;
  /**
   * When `true`, the proxy exposes `onEnablePIP`/`onDisablePIP` handlers that reduce `isPIP`
   * (video skin — audio has no Picture-in-Picture). Defaults to `false`.
   */
  includePipHandlers?: boolean;
  /**
   * When `true`, the proxy exposes an `onPlayBackQualityChange` handler that reduces
   * `playbackQuality` (video skin multi-quality). Defaults to `false`.
   */
  includeQualityHandler?: boolean;
  /**
   * When `true`, `onError` ignores transient browser autoplay/abort errors (`NotAllowedError`,
   * `AbortError`) read from the ERROR object's `name`/`message` — they are not fatal. Defaults to
   * `false`.
   */
  skipAutoplayErrors?: boolean;
  /**
   * Whether a FATAL error also sets `playing: false`. Defaults to `true`. The video skin passes
   * `false` so a structured HLS/DASH/FLV error surfaces `kernelError` + `isLoading:false` without
   * overriding the user's play intent.
   */
  clearPlayingOnFatalError?: boolean;
}

/** The proxy object of lifecycle handlers produced by the factory. */
export interface PlayerCallbackProxy {
  onBuffer: (...args: unknown[]) => void;
  onBufferEnd: (...args: unknown[]) => void;
  onDuration: (duration: number) => void;
  onEnded: () => void;
  onError: (error: unknown, data?: PlayerErrorData, instance?: unknown, sdk?: unknown) => void;
  onPause: () => void;
  onPlay: (event?: { hasAudio?: boolean }) => void;
  onPlayBackRateChange: (rate: number) => void;
  onProgress: (state: { playedSeconds?: number; played?: number; loaded?: number; bufferedRanges?: unknown[] }) => void;
  onReady: () => void;
  onSeek: (time: number) => void;
  onStart: (...args: unknown[]) => void;
  onLoaded: (...args: unknown[]) => void;
  onMount: (...args: unknown[]) => void;
  // Present only when the matching config flag is enabled (video skin).
  onEnablePIP?: (event?: unknown) => void;
  onDisablePIP?: (event?: unknown) => void;
  onPlayBackQualityChange?: (quality: number) => void;
}
