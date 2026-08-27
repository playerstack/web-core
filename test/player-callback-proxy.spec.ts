import {
  createPlayerCallbackProxy,
  DEFAULT_RECOVERABLE_ERROR_TYPES,
  DEFAULT_RECOVERABLE_ERROR_DETAILS,
} from '@player-callback-proxy';
import type { PlayerProxyCallbacks, PlayerStateUpdate } from '@typings/player-callback-proxy.types';

/**
 * Spec for `createPlayerCallbackProxy` — the framework-agnostic player-event → state-update proxy
 * (migrated from the reactjs/audio `usePlayerCallbackProxy`). It verifies that each lifecycle
 * handler forwards to the consumer callback AND reduces the correct state patch, that error
 * classification ignores recoverable errors and stops playback on fatal ones, that progress is
 * ignored while seeking, and that `prevented` forces `hasAudio` on play.
 */

type State = Record<string, unknown>;

/** Builds a proxy over mutable holders so tests can drive callbacks/seeking/prevented + capture state. */
function setup(
  opts: {
    callbacks?: PlayerProxyCallbacks;
    seeking?: boolean;
    prevented?: boolean;
    recoverableErrorTypes?: readonly string[];
    recoverableErrorDetails?: readonly string[];
  } = {},
) {
  const holder = {
    callbacks: opts.callbacks ?? {},
    seeking: opts.seeking ?? false,
    prevented: opts.prevented ?? false,
    state: {} as State,
  };
  const applyStateUpdate = (update: PlayerStateUpdate<State>): void => {
    holder.state = typeof update === 'function' ? update(holder.state) : { ...holder.state, ...update };
  };
  const proxy = createPlayerCallbackProxy<State>({
    getCallbacks: () => holder.callbacks,
    applyStateUpdate,
    getSeeking: () => holder.seeking,
    getPrevented: () => holder.prevented,
    recoverableErrorTypes: opts.recoverableErrorTypes,
    recoverableErrorDetails: opts.recoverableErrorDetails,
  });
  return { proxy, holder };
}

describe('createPlayerCallbackProxy', () => {
  it('exposes the default recoverable error lists', () => {
    expect(DEFAULT_RECOVERABLE_ERROR_TYPES).toContain('networkError');
    expect(DEFAULT_RECOVERABLE_ERROR_DETAILS).toContain('bufferStalledError');
  });

  describe('buffering', () => {
    it('onBuffer forwards + sets isBuffering true; onBufferEnd sets false', () => {
      const onBuffer = jest.fn();
      const onBufferEnd = jest.fn();
      const { proxy, holder } = setup({ callbacks: { onBuffer, onBufferEnd } });

      proxy.onBuffer();
      expect(onBuffer).toHaveBeenCalledTimes(1);
      expect(holder.state.isBuffering).toBe(true);

      proxy.onBufferEnd();
      expect(onBufferEnd).toHaveBeenCalledTimes(1);
      expect(holder.state.isBuffering).toBe(false);
    });
  });

  describe('duration / ended / rate / seek', () => {
    it('reduces the matching state and forwards', () => {
      const cbs = {
        onDuration: jest.fn(),
        onEnded: jest.fn(),
        onPlayBackRateChange: jest.fn(),
        onSeek: jest.fn(),
      };
      const { proxy, holder } = setup({ callbacks: cbs });

      proxy.onDuration(120);
      expect(cbs.onDuration).toHaveBeenCalledWith(120);
      expect(holder.state.duration).toBe(120);

      proxy.onEnded();
      expect(cbs.onEnded).toHaveBeenCalled();
      expect(holder.state.isEnded).toBe(true);

      proxy.onPlayBackRateChange(1.5);
      expect(cbs.onPlayBackRateChange).toHaveBeenCalledWith(1.5);
      expect(holder.state.playbackRate).toBe(1.5);

      proxy.onSeek(42);
      expect(cbs.onSeek).toHaveBeenCalledWith(42);
      expect(holder.state.seek).toBe(42);
    });
  });

  describe('pause / play', () => {
    it('onPause sets playing false; onPlay sets playing true + isEnded false', () => {
      const { proxy, holder } = setup();
      proxy.onPause();
      expect(holder.state.playing).toBe(false);

      proxy.onPlay({ hasAudio: true });
      expect(holder.state.playing).toBe(true);
      expect(holder.state.isEnded).toBe(false);
      expect(holder.state.hasAudio).toBe(true);
    });

    it('onPlay resolves hasAudio from event OR previous state', () => {
      const { proxy, holder } = setup();
      holder.state = { hasAudio: true };
      proxy.onPlay({ hasAudio: false });
      // previous hasAudio true is preserved.
      expect(holder.state.hasAudio).toBe(true);
    });

    it('onPlay forces hasAudio true when prevented', () => {
      const { proxy, holder } = setup({ prevented: true });
      proxy.onPlay({ hasAudio: false });
      expect(holder.state.hasAudio).toBe(true);
    });
  });

  describe('progress', () => {
    it('updates played/loaded when not seeking', () => {
      const onProgress = jest.fn();
      const { proxy, holder } = setup({ callbacks: { onProgress } });
      proxy.onProgress({ playedSeconds: 10, loaded: 30 });
      expect(onProgress).toHaveBeenCalled();
      expect(holder.state.played).toBe(10);
      expect(holder.state.loaded).toBe(30);
    });

    it('forwards but does NOT update state while seeking', () => {
      const onProgress = jest.fn();
      const { proxy, holder } = setup({ callbacks: { onProgress }, seeking: true });
      proxy.onProgress({ playedSeconds: 10, loaded: 30 });
      expect(onProgress).toHaveBeenCalled();
      expect(holder.state.played).toBeUndefined();
      expect(holder.state.loaded).toBeUndefined();
    });

    it('falls back to `played` when `playedSeconds` is absent', () => {
      const { proxy, holder } = setup();
      proxy.onProgress({ played: 5, loaded: 8 });
      expect(holder.state.played).toBe(5);
    });
  });

  describe('ready', () => {
    it('clears isLoading and forwards', () => {
      const onReady = jest.fn();
      const { proxy, holder } = setup({ callbacks: { onReady } });
      holder.state = { isLoading: true };
      proxy.onReady();
      expect(onReady).toHaveBeenCalled();
      expect(holder.state.isLoading).toBe(false);
    });
  });

  describe('error classification', () => {
    it('ignores a recoverable networkError (no fatal state)', () => {
      const onError = jest.fn();
      const { proxy, holder } = setup({ callbacks: { onError } });
      proxy.onError(new Error('x'), { type: 'networkError' });
      expect(onError).toHaveBeenCalled();
      expect(holder.state.kernelError).toBeUndefined();
      expect(holder.state.playing).toBeUndefined();
    });

    it('ignores a recoverable mediaError detail', () => {
      const { proxy, holder } = setup();
      proxy.onError(new Error('x'), { type: 'mediaError', details: 'bufferStalledError' });
      expect(holder.state.kernelError).toBeUndefined();
    });

    it('sets kernelError + stops playback on a fatal error', () => {
      const { proxy, holder } = setup();
      proxy.onError(new Error('x'), { type: 'fatalThing', error: { message: 'boom' } });
      expect(holder.state.kernelError).toEqual({ type: 'fatalThing', detail: 'boom' });
      expect(holder.state.isLoading).toBe(false);
      expect(holder.state.playing).toBe(false);
    });

    it('uses a default detail message when none is provided', () => {
      const { proxy, holder } = setup();
      proxy.onError(new Error('x'), { type: 'fatalThing' });
      expect((holder.state.kernelError as { detail: string }).detail).toContain('Something was wrong');
    });

    it('null data leaves kernelError null', () => {
      const { proxy, holder } = setup();
      proxy.onError(new Error('x'));
      expect(holder.state.kernelError).toBeNull();
    });

    it('honors custom recoverable lists', () => {
      const { proxy, holder } = setup({ recoverableErrorTypes: ['myOkError'] });
      proxy.onError(new Error('x'), { type: 'myOkError' });
      expect(holder.state.kernelError).toBeUndefined();
    });
  });

  describe('pass-through handlers', () => {
    it('onStart / onLoaded / onMount only forward (no state change)', () => {
      const cbs = { onStart: jest.fn(), onLoaded: jest.fn(), onMount: jest.fn() };
      const { proxy, holder } = setup({ callbacks: cbs });
      proxy.onStart();
      proxy.onLoaded();
      proxy.onMount();
      expect(cbs.onStart).toHaveBeenCalled();
      expect(cbs.onLoaded).toHaveBeenCalled();
      expect(cbs.onMount).toHaveBeenCalled();
      expect(holder.state).toEqual({});
    });

    it('handlers are safe when no callbacks are provided', () => {
      const { proxy } = setup();
      expect(() => {
        proxy.onBuffer();
        proxy.onStart();
        proxy.onDuration(1);
      }).not.toThrow();
    });
  });

  describe('skin-specific flags', () => {
    it('clearPlayingOnEnded also sets playing false on ended (audio parity)', () => {
      const holder = {
        callbacks: {} as PlayerProxyCallbacks,
        seeking: false,
        prevented: false,
        state: {} as State,
      };
      const proxy = createPlayerCallbackProxy<State>({
        getCallbacks: () => holder.callbacks,
        applyStateUpdate: (u) => {
          holder.state = typeof u === 'function' ? u(holder.state) : { ...holder.state, ...u };
        },
        getSeeking: () => holder.seeking,
        getPrevented: () => holder.prevented,
        clearPlayingOnEnded: true,
      });
      proxy.onEnded();
      expect(holder.state.isEnded).toBe(true);
      expect(holder.state.playing).toBe(false);
    });

    it('includeBufferedRangesOnProgress reduces bufferedRanges (audio parity)', () => {
      const holder = {
        callbacks: {} as PlayerProxyCallbacks,
        seeking: false,
        prevented: false,
        state: {} as State,
      };
      const proxy = createPlayerCallbackProxy<State>({
        getCallbacks: () => holder.callbacks,
        applyStateUpdate: (u) => {
          holder.state = typeof u === 'function' ? u(holder.state) : { ...holder.state, ...u };
        },
        getSeeking: () => holder.seeking,
        getPrevented: () => holder.prevented,
        includeBufferedRangesOnProgress: true,
      });
      proxy.onProgress({ playedSeconds: 5, loaded: 10, bufferedRanges: [{ start: 0, end: 5 }] });
      expect(holder.state.bufferedRanges).toEqual([{ start: 0, end: 5 }]);
    });

    it('default (video) does NOT touch playing on ended nor add bufferedRanges', () => {
      const { proxy, holder } = setup();
      proxy.onEnded();
      expect(holder.state.playing).toBeUndefined();
      proxy.onProgress({ playedSeconds: 5, loaded: 10, bufferedRanges: [{ start: 0, end: 5 }] });
      expect(holder.state.bufferedRanges).toBeUndefined();
    });
  });

  describe('video-skin flags (PIP / quality / autoplay / fatal)', () => {
    function videoSetup() {
      const holder = {
        callbacks: {} as PlayerProxyCallbacks,
        seeking: false,
        prevented: false,
        state: {} as State,
      };
      const proxy = createPlayerCallbackProxy<State>({
        getCallbacks: () => holder.callbacks,
        applyStateUpdate: (u) => {
          holder.state = typeof u === 'function' ? u(holder.state) : { ...holder.state, ...u };
        },
        getSeeking: () => holder.seeking,
        getPrevented: () => holder.prevented,
        includePipHandlers: true,
        includeQualityHandler: true,
        skipAutoplayErrors: true,
        clearPlayingOnFatalError: false,
      });
      return { proxy, holder };
    }

    it('exposes PIP handlers that reduce isPIP', () => {
      const { proxy, holder } = videoSetup();
      expect(typeof proxy.onEnablePIP).toBe('function');
      proxy.onEnablePIP?.();
      expect(holder.state.isPIP).toBe(true);
      proxy.onDisablePIP?.();
      expect(holder.state.isPIP).toBe(false);
    });

    it('exposes a quality handler that reduces playbackQuality', () => {
      const { proxy, holder } = videoSetup();
      proxy.onPlayBackQualityChange?.(720);
      expect(holder.state.playbackQuality).toBe(720);
    });

    it('skipAutoplayErrors ignores NotAllowedError/AbortError (no fatal state)', () => {
      const { proxy, holder } = videoSetup();
      proxy.onError({ name: 'NotAllowedError' });
      proxy.onError({ name: 'AbortError' });
      expect(holder.state.kernelError).toBeUndefined();
    });

    it('clearPlayingOnFatalError=false surfaces kernelError WITHOUT clearing playing', () => {
      const { proxy, holder } = videoSetup();
      holder.state = { playing: true };
      proxy.onError(new Error('x'), { type: 'fatalThing', error: { message: 'boom' } });
      expect(holder.state.kernelError).toEqual({ type: 'fatalThing', detail: 'boom' });
      expect(holder.state.isLoading).toBe(false);
      // Play intent preserved.
      expect(holder.state.playing).toBe(true);
    });

    it('clearPlayingOnFatalError=false ignores a null-data error (no kernelError)', () => {
      const { proxy, holder } = videoSetup();
      proxy.onError(new Error('x'));
      expect(holder.state.kernelError).toBeUndefined();
    });

    it('audio/default proxy does NOT expose PIP/quality handlers', () => {
      const { proxy } = setup();
      expect(proxy.onEnablePIP).toBeUndefined();
      expect(proxy.onDisablePIP).toBeUndefined();
      expect(proxy.onPlayBackQualityChange).toBeUndefined();
    });
  });

  it('reads the LATEST callbacks through the getter (stable proxy identity)', () => {
    const { proxy, holder } = setup();
    const first = jest.fn();
    const second = jest.fn();
    holder.callbacks = { onReady: first };
    proxy.onReady();
    holder.callbacks = { onReady: second };
    proxy.onReady();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
