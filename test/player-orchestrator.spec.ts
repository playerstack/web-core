import { PlayerOrchestrator } from '@player-orchestrator';

// Minimal mock that satisfies MediaEngine interface used by PlayerOrchestrator
function createMockEngine() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return this;
    }),
    off: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.get(event)?.delete(handler);
      return this;
    }),
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((h) => h(...args));
    },
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    load: jest.fn(),
    seekTo: jest.fn(),
    setVolume: jest.fn(),
    getVolume: jest.fn(() => 0.8),
    mute: jest.fn(),
    unmute: jest.fn(),
    setPlaybackRate: jest.fn(),
    setLoop: jest.fn(),
    getDuration: jest.fn(() => 100),
    getCurrentTime: jest.fn(() => 50),
    getSecondsLoaded: jest.fn(() => 75),
    getBufferedRanges: jest.fn(() => [{ start: 0, end: 75 }]),
    hasEnded: jest.fn(() => false),
    destroy: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

describe('PlayerOrchestrator', () => {
  let engine: ReturnType<typeof createMockEngine>;
  let orchestrator: PlayerOrchestrator;

  beforeEach(() => {
    jest.useFakeTimers();
    engine = createMockEngine();
    orchestrator = new PlayerOrchestrator(engine as any);
  });

  afterEach(() => {
    orchestrator.destroy();
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('starts as not ready, loading, not playing', () => {
      expect(orchestrator.isReady).toBe(false);
      expect(orchestrator.isLoading).toBe(true);
      expect(orchestrator.isPlaying).toBe(false);
    });

    it('subscribes to engine events on construction', () => {
      expect(engine.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(engine.on).toHaveBeenCalledWith('play', expect.any(Function));
      expect(engine.on).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(engine.on).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(engine.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('setPlaying', () => {
    it('does nothing when not ready', () => {
      orchestrator.setPlaying(true);
      expect(engine.play).not.toHaveBeenCalled();
    });

    it('calls engine.play() when ready and not playing', () => {
      engine.emit('ready');
      orchestrator.setPlaying(true);
      expect(engine.play).toHaveBeenCalled();
    });

    it('calls engine.pause() when ready and playing', () => {
      engine.emit('ready');
      engine.emit('play');
      orchestrator.setPlaying(false);
      expect(engine.pause).toHaveBeenCalled();
    });

    it('does not call play when already playing', () => {
      engine.emit('ready');
      engine.emit('play');
      orchestrator.setPlaying(true);
      expect(engine.play).not.toHaveBeenCalled();
    });
  });

  describe('setVolume', () => {
    it('calls engine.setVolume when ready', () => {
      engine.emit('ready');
      orchestrator.setVolume(0.5);
      expect(engine.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('does nothing when not ready', () => {
      orchestrator.setVolume(0.5);
      expect(engine.setVolume).not.toHaveBeenCalled();
    });
  });

  describe('setMuted', () => {
    it('calls engine.mute() when true', () => {
      engine.emit('ready');
      orchestrator.setMuted(true);
      expect(engine.mute).toHaveBeenCalled();
    });

    it('calls engine.unmute() when false', () => {
      engine.emit('ready');
      orchestrator.setMuted(false);
      expect(engine.unmute).toHaveBeenCalled();
    });
  });

  describe('setPlaybackRate', () => {
    it('calls engine.setPlaybackRate when ready', () => {
      engine.emit('ready');
      orchestrator.setPlaybackRate(2);
      expect(engine.setPlaybackRate).toHaveBeenCalledWith(2);
    });
  });

  describe('load', () => {
    it('first load goes through immediately even when not ready', () => {
      orchestrator.load('https://example.com/video.mp4');
      expect(engine.load).toHaveBeenCalledWith('https://example.com/video.mp4');
    });

    it('defers second load when first load is still in progress (not ready)', () => {
      orchestrator.load('https://example.com/first.mp4');
      engine.load.mockClear();
      orchestrator.load('https://example.com/second.mp4');
      // Second load deferred because first hasn't completed (no ready event)
      expect(engine.load).not.toHaveBeenCalled();
    });

    it('loads deferred URL on ready', () => {
      orchestrator.load('https://example.com/first.mp4');
      engine.load.mockClear();
      orchestrator.load('https://example.com/second.mp4');
      engine.emit('ready');
      expect(engine.load).toHaveBeenCalledWith('https://example.com/second.mp4');
    });

    it('loads immediately when ready', () => {
      engine.emit('ready');
      engine.emit('play');
      orchestrator.load('https://example.com/new.mp4');
      expect(engine.load).toHaveBeenCalledWith('https://example.com/new.mp4');
    });

    it('does nothing for empty url', () => {
      engine.emit('ready');
      orchestrator.load('');
      expect(engine.load).not.toHaveBeenCalled();
    });
  });

  describe('seekTo', () => {
    it('queues seek when not ready', () => {
      orchestrator.seekTo(30);
      expect(engine.seekTo).not.toHaveBeenCalled();
    });

    it('applies queued seek on play', () => {
      orchestrator.seekTo(30);
      engine.emit('ready');
      engine.emit('play');
      expect(engine.seekTo).toHaveBeenCalledWith(30);
    });

    it('expires queued seek after 5000ms', () => {
      orchestrator.seekTo(30);
      jest.advanceTimersByTime(5000);
      engine.emit('ready');
      engine.emit('play');
      expect(engine.seekTo).not.toHaveBeenCalled();
    });

    it('seeks immediately when ready', () => {
      engine.emit('ready');
      orchestrator.seekTo(45);
      expect(engine.seekTo).toHaveBeenCalledWith(45, undefined);
    });

    it('ignores NaN', () => {
      engine.emit('ready');
      orchestrator.seekTo(NaN);
      expect(engine.seekTo).not.toHaveBeenCalled();
    });

    it('ignores Infinity', () => {
      engine.emit('ready');
      orchestrator.seekTo(Infinity);
      expect(engine.seekTo).not.toHaveBeenCalled();
    });
  });

  describe('live: sync to live edge on first play', () => {
    // On the first play of a live stream, the orchestrator seeks to the live edge (seekable end,
    // via getDuration) minus a small margin, so playback starts synced to the broadcast.
    it('seeks to the live edge (getDuration - margin) on the first play when live', () => {
      const liveEngine = createMockEngine();
      liveEngine.getDuration.mockReturnValue(200);
      const orch = new PlayerOrchestrator(liveEngine as any, { live: true });
      liveEngine.emit('ready');
      liveEngine.emit('play');
      // 200 (seekable end) - LIVE_EDGE_SEEK_MARGIN (3) = 197.
      expect(liveEngine.seekTo).toHaveBeenCalledWith(197);
      orch.destroy();
    });

    it('also syncs on first play for liveDVR', () => {
      const liveEngine = createMockEngine();
      liveEngine.getDuration.mockReturnValue(200);
      const orch = new PlayerOrchestrator(liveEngine as any, { liveDVR: true });
      liveEngine.emit('ready');
      liveEngine.emit('play');
      expect(liveEngine.seekTo).toHaveBeenCalledWith(197);
      orch.destroy();
    });

    it('only syncs ONCE — a later play does not re-seek to the edge (respects DVR position)', () => {
      const liveEngine = createMockEngine();
      liveEngine.getDuration.mockReturnValue(200);
      const orch = new PlayerOrchestrator(liveEngine as any, { liveDVR: true });
      liveEngine.emit('ready');
      liveEngine.emit('play');
      expect(liveEngine.seekTo).toHaveBeenCalledTimes(1);

      // Pause + play again (e.g. user scrubbed back then resumed): no second edge seek.
      liveEngine.emit('pause');
      liveEngine.seekTo.mockClear();
      liveEngine.emit('play');
      expect(liveEngine.seekTo).not.toHaveBeenCalled();
      orch.destroy();
    });

    it('does NOT seek to the edge for a non-live stream', () => {
      const vodEngine = createMockEngine();
      const orch = new PlayerOrchestrator(vodEngine as any); // no live flag
      vodEngine.emit('ready');
      vodEngine.emit('play');
      expect(vodEngine.seekTo).not.toHaveBeenCalled();
      orch.destroy();
    });
  });

  describe('autoplay blocked: mute + retry (YouTube/Twitch UX)', () => {
    it('mutes, retries play, and emits autoplayMuted when autoplay-with-sound is blocked', () => {
      engine.emit('ready');
      orchestrator.setPlaying(true); // consumer wants to play
      engine.play.mockClear();
      const muted = jest.fn();
      orchestrator.on('autoplayMuted', muted);

      engine.emit('autoplayBlocked');

      expect(engine.mute).toHaveBeenCalledTimes(1);
      expect(engine.play).toHaveBeenCalledTimes(1); // retried
      expect(muted).toHaveBeenCalledTimes(1);
    });

    it('only auto-mutes ONCE (a second block does not re-mute/re-emit)', () => {
      engine.emit('ready');
      orchestrator.setPlaying(true);
      const muted = jest.fn();
      orchestrator.on('autoplayMuted', muted);

      engine.emit('autoplayBlocked');
      engine.emit('autoplayBlocked');

      expect(muted).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the consumer did not request play', () => {
      engine.emit('ready'); // _wantsToPlay stays false
      const muted = jest.fn();
      orchestrator.on('autoplayMuted', muted);

      engine.emit('autoplayBlocked');

      expect(engine.mute).not.toHaveBeenCalled();
      expect(muted).not.toHaveBeenCalled();
    });

    it('with autoplayFallback "pause": does NOT mute, emits autoplayPaused + pause (big play button)', () => {
      const eng = createMockEngine();
      const orch = new PlayerOrchestrator(eng as any, { autoplayFallback: 'pause' });
      eng.emit('ready');
      orch.setPlaying(true);
      eng.play.mockClear();
      const paused = jest.fn();
      const pauseEvt = jest.fn();
      const muted = jest.fn();
      orch.on('autoplayPaused', paused);
      orch.on('pause', pauseEvt);
      orch.on('autoplayMuted', muted);

      eng.emit('autoplayBlocked');

      expect(eng.mute).not.toHaveBeenCalled(); // never mutes in 'pause' mode
      expect(eng.play).not.toHaveBeenCalled(); // no silent retry
      expect(paused).toHaveBeenCalledTimes(1);
      expect(pauseEvt).toHaveBeenCalledTimes(1);
      expect(muted).not.toHaveBeenCalled();
      orch.destroy();
    });
  });

  describe('progress polling', () => {
    it('emits progress after play with correct ratios', () => {
      const handler = jest.fn();
      orchestrator.on('progress', handler);

      engine.emit('ready');
      engine.emit('play');

      jest.advanceTimersByTime(1000);

      expect(handler).toHaveBeenCalledWith({
        played: 0.5,
        loaded: 0.75,
        playedSeconds: 50,
        loadedSeconds: 75,
        bufferedRanges: [{ start: 0, end: 75 }],
      });
    });

    it('does not emit when values unchanged', () => {
      const handler = jest.fn();
      orchestrator.on('progress', handler);

      engine.emit('ready');
      engine.emit('play');

      jest.advanceTimersByTime(1000);
      handler.mockClear();

      // Same values — no new emission
      jest.advanceTimersByTime(1000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('stops polling on pause', () => {
      const handler = jest.fn();
      orchestrator.on('progress', handler);

      engine.emit('ready');
      engine.emit('play');
      engine.emit('pause');

      handler.mockClear();
      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('duration check retry', () => {
    it('emits duration when available on ready', () => {
      const handler = jest.fn();
      orchestrator.on('duration', handler);
      engine.emit('ready');
      expect(handler).toHaveBeenCalledWith(100);
    });

    it('retries when duration is 0', () => {
      engine.getDuration.mockReturnValue(0);
      const handler = jest.fn();
      orchestrator.on('duration', handler);

      engine.emit('ready');
      expect(handler).not.toHaveBeenCalled();

      // After some retries, return valid duration
      engine.getDuration.mockReturnValue(120);
      jest.advanceTimersByTime(100);
      expect(handler).toHaveBeenCalledWith(120);
    });

    it('stops retrying after 10 attempts', () => {
      engine.getDuration.mockReturnValue(0);
      const handler = jest.fn();
      orchestrator.on('duration', handler);

      engine.emit('ready');
      jest.advanceTimersByTime(1100); // 10 retries at 100ms + buffer
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('ended event', () => {
    it('emits ended and stops progress', () => {
      const endedHandler = jest.fn();
      const progressHandler = jest.fn();
      orchestrator.on('ended', endedHandler);
      orchestrator.on('progress', progressHandler);

      engine.emit('ready');
      engine.emit('play');
      engine.emit('ended');

      expect(endedHandler).toHaveBeenCalled();
      expect(orchestrator.isPlaying).toBe(false);

      progressHandler.mockClear();
      jest.advanceTimersByTime(5000);
      expect(progressHandler).not.toHaveBeenCalled();
    });
  });

  describe('pause at end of stream', () => {
    it('propagates a pause that coincides with element end as ended', () => {
      // Regression: live/MSE pipelines may fire `pause` at the edge without a
      // following `ended`. With _wantsToPlay still true, the transient-pause
      // guard would swallow it and leave the skin stuck as "playing".
      const endedHandler = jest.fn();
      const pauseHandler = jest.fn();
      orchestrator.on('ended', endedHandler);
      orchestrator.on('pause', pauseHandler);

      engine.emit('ready');
      engine.emit('play'); // _wantsToPlay = true

      engine.hasEnded.mockReturnValue(true);
      engine.emit('pause');

      expect(endedHandler).toHaveBeenCalled();
      expect(pauseHandler).not.toHaveBeenCalled();
      expect(orchestrator.isPlaying).toBe(false);
    });

    it('still swallows a transient buffering pause when not ended', () => {
      const endedHandler = jest.fn();
      const pauseHandler = jest.fn();
      orchestrator.on('ended', endedHandler);
      orchestrator.on('pause', pauseHandler);

      engine.emit('ready');
      engine.emit('play'); // _wantsToPlay = true

      engine.hasEnded.mockReturnValue(false);
      engine.emit('pause');

      expect(endedHandler).not.toHaveBeenCalled();
      expect(pauseHandler).not.toHaveBeenCalled();
    });
  });

  describe('liveEnded event', () => {
    it('forwards engine liveEnded to consumers', () => {
      const handler = jest.fn();
      orchestrator.on('liveEnded', handler);
      engine.emit('liveEnded');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not forward liveEnded after destroy', () => {
      const handler = jest.fn();
      orchestrator.on('liveEnded', handler);
      orchestrator.destroy();
      engine.emit('liveEnded');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('error event', () => {
    it('emits error and sets not loading', () => {
      const handler = jest.fn();
      orchestrator.on('error', handler);
      engine.emit('error', new Error('test'));
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
      expect(orchestrator.isLoading).toBe(false);
    });
  });

  describe('destroy', () => {
    it('unsubscribes from engine events', () => {
      orchestrator.destroy();
      expect(engine.off).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(engine.off).toHaveBeenCalledWith('play', expect.any(Function));
      expect(engine.off).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(engine.off).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(engine.off).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('calls engine.destroy() by default', () => {
      orchestrator.destroy();
      expect(engine.destroy).toHaveBeenCalled();
    });

    it('does not call engine.destroy() when stopOnDestroy is false', () => {
      const orch2 = new PlayerOrchestrator(engine as any, { stopOnDestroy: false });
      orch2.destroy();
      expect(engine.destroy).not.toHaveBeenCalled();
    });

    it('stops progress timer', () => {
      const handler = jest.fn();
      orchestrator.on('progress', handler);
      engine.emit('ready');
      engine.emit('play');

      orchestrator.destroy();
      handler.mockClear();
      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores calls after destroy', () => {
      orchestrator.destroy();
      orchestrator.setPlaying(true);
      orchestrator.load('url');
      orchestrator.seekTo(10);
      expect(engine.play).not.toHaveBeenCalled();
      expect(engine.load).not.toHaveBeenCalled();
    });
  });
});
