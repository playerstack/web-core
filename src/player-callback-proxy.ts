import type {
  PlayerCallbackProxy,
  PlayerCallbackProxyConfig,
  PlayerErrorData,
} from '@typings/player-callback-proxy.types';

export type {
  PlayerCallbackProxy,
  PlayerCallbackProxyConfig,
  PlayerProxyCallbacks,
  PlayerStateUpdate,
  PlayerErrorData,
} from '@typings/player-callback-proxy.types';

/** Default error `type` values treated as recoverable (ignored — no fatal state). */
export const DEFAULT_RECOVERABLE_ERROR_TYPES: readonly string[] = ['networkError'];

/** Default `mediaError` `details` values treated as recoverable (ignored — no fatal state). */
export const DEFAULT_RECOVERABLE_ERROR_DETAILS: readonly string[] = [
  'bufferStalledError',
  'bufferNudgeOnStall',
  'bufferAppendError',
  'fragParsingError',
];

/**
 * Builds a framework-agnostic player-callback proxy: a stable object of lifecycle handlers that
 * (1) forward each event to the consumer's callback and (2) reduce the matching playback-state
 * update. It centralizes the player-event → state-update mapping (buffering, duration, ended,
 * error classification, pause/play, rate, progress, ready, seek) that was previously duplicated
 * as a React hook in the reactjs and audio skins.
 *
 * WHY a factory over getters (no React in core): the proxy must keep a STABLE identity across a
 * framework's re-renders (e.g. React.memo on the player component) while always reading the latest
 * callbacks/state. Instead of using framework refs, the caller passes GETTER functions
 * (`getCallbacks`, `getSeeking`, `getPrevented`) that read from wherever the skin stores the fresh
 * values, and an `applyStateUpdate` that writes to the skin's state. The returned object is built
 * once by the skin and never needs to change identity.
 *
 * Error classification mirrors the original: an error whose `type` is in `recoverableErrorTypes`,
 * or a `mediaError` whose `details` is in `recoverableErrorDetails`, is IGNORED (no fatal state);
 * any other error sets `kernelError` and stops playback.
 */
export function createPlayerCallbackProxy<S = Record<string, unknown>>(
  config: PlayerCallbackProxyConfig<S>,
): PlayerCallbackProxy {
  const {
    getCallbacks,
    applyStateUpdate,
    getSeeking,
    getPrevented,
    recoverableErrorTypes = DEFAULT_RECOVERABLE_ERROR_TYPES,
    recoverableErrorDetails = DEFAULT_RECOVERABLE_ERROR_DETAILS,
    clearPlayingOnEnded = false,
    includeBufferedRangesOnProgress = false,
    includePipHandlers = false,
    includeQualityHandler = false,
    skipAutoplayErrors = false,
    clearPlayingOnFatalError = true,
  } = config;

  // Local helper: apply a functional update, typed loosely so core stays state-shape-agnostic.
  const patch = (updater: (prev: Record<string, unknown>) => Record<string, unknown>): void => {
    applyStateUpdate(updater as unknown as (prev: S) => S);
  };

  const isRecoverable = (data?: PlayerErrorData): boolean => {
    const type = data?.type;
    const details = data?.details;
    return (
      (type !== undefined && recoverableErrorTypes.includes(type)) ||
      (type === 'mediaError' && details !== undefined && recoverableErrorDetails.includes(details))
    );
  };

  // Transient browser autoplay/abort errors read from the ERROR object's name/message.
  const isAutoplayBlocked = (error: unknown): boolean => {
    const e = error as { name?: string; message?: string } | null | undefined;
    const name = e?.name || e?.message || '';
    return name === 'NotAllowedError' || name === 'AbortError';
  };

  const proxy: PlayerCallbackProxy = {
    onBuffer(...args: unknown[]): void {
      (getCallbacks().onBuffer as ((...a: unknown[]) => void) | undefined)?.(...args);
      patch((prev) => ({ ...prev, isBuffering: true }));
    },
    onBufferEnd(...args: unknown[]): void {
      (getCallbacks().onBufferEnd as ((...a: unknown[]) => void) | undefined)?.(...args);
      patch((prev) => ({ ...prev, isBuffering: false }));
    },
    onDuration(duration: number): void {
      getCallbacks().onDuration?.(duration);
      patch((prev) => ({ ...prev, duration }));
    },
    onEnded(): void {
      getCallbacks().onEnded?.();
      patch((prev) => (clearPlayingOnEnded ? { ...prev, isEnded: true, playing: false } : { ...prev, isEnded: true }));
    },
    onError(error: unknown, data?: PlayerErrorData, instance?: unknown, sdk?: unknown): void {
      getCallbacks().onError?.(error, data, instance, sdk);
      // Transient autoplay/abort errors are never fatal (video skin).
      if (skipAutoplayErrors && isAutoplayBlocked(error)) {
        return;
      }
      if (isRecoverable(data)) {
        return;
      }
      // Only surface a fatal kernelError for STRUCTURED errors (data present). When
      // `clearPlayingOnFatalError` is false (video skin), the user's play intent is preserved.
      if (!data) {
        if (clearPlayingOnFatalError) {
          patch((prev) => ({ ...prev, kernelError: null, isLoading: false, playing: false }));
        }
        return;
      }
      patch((prev) => {
        const next: Record<string, unknown> = {
          ...prev,
          kernelError: {
            type: data.type || 'UnknownError',
            detail: data.error?.message || 'Something was wrong with the playback. Please try again.',
          },
          isLoading: false,
        };
        if (clearPlayingOnFatalError) {
          next.playing = false;
        }
        return next;
      });
    },
    onPause(): void {
      getCallbacks().onPause?.();
      patch((prev) => ({ ...prev, playing: false }));
    },
    onPlay(event?: { hasAudio?: boolean }): void {
      getCallbacks().onPlay?.(event);
      const prevented = getPrevented();
      patch((prev) => {
        const audioFromEvent = event?.hasAudio ?? false;
        const resolvedHasAudio = prevented ? true : audioFromEvent || Boolean(prev.hasAudio);
        return { ...prev, playing: true, isEnded: false, hasAudio: resolvedHasAudio };
      });
    },
    onPlayBackRateChange(rate: number): void {
      getCallbacks().onPlayBackRateChange?.(rate);
      patch((prev) => ({ ...prev, playbackRate: rate }));
    },
    onProgress(state: { playedSeconds?: number; played?: number; loaded?: number; bufferedRanges?: unknown[] }): void {
      getCallbacks().onProgress?.(state);
      if (getSeeking()) {
        return;
      }
      patch((prev) => {
        const next: Record<string, unknown> = {
          ...prev,
          played: state.playedSeconds ?? state.played,
          loaded: state.loaded,
        };
        if (includeBufferedRangesOnProgress) {
          next.bufferedRanges = state.bufferedRanges || [];
        }
        return next;
      });
    },
    onReady(): void {
      getCallbacks().onReady?.();
      patch((prev) => ({ ...prev, isLoading: false }));
    },
    onSeek(time: number): void {
      getCallbacks().onSeek?.(time);
      patch((prev) => ({ ...prev, seek: time }));
    },
    onStart(...args: unknown[]): void {
      (getCallbacks().onStart as ((...a: unknown[]) => void) | undefined)?.(...args);
    },
    onLoaded(...args: unknown[]): void {
      (getCallbacks().onLoaded as ((...a: unknown[]) => void) | undefined)?.(...args);
    },
    onMount(...args: unknown[]): void {
      (getCallbacks().onMount as ((...a: unknown[]) => void) | undefined)?.(...args);
    },
  };

  // Video-only handlers, added on demand so audio never exposes PIP/quality.
  if (includePipHandlers) {
    proxy.onEnablePIP = (event?: unknown): void => {
      getCallbacks().onEnablePIP?.(event);
      patch((prev) => ({ ...prev, isPIP: true }));
    };
    proxy.onDisablePIP = (event?: unknown): void => {
      getCallbacks().onDisablePIP?.(event);
      patch((prev) => ({ ...prev, isPIP: false }));
    };
  }
  if (includeQualityHandler) {
    proxy.onPlayBackQualityChange = (quality: number): void => {
      getCallbacks().onPlayBackQualityChange?.(quality);
      patch((prev) => ({ ...prev, playbackQuality: quality }));
    };
  }

  return proxy;
}
