/**
 * Unit test for the Vanilla_Build `initPlayer` adapter wiring (Req 6.1, 6.2).
 *
 * The Vanilla_Build integration test (`vanilla.integration.spec.ts`) proves the
 * end-to-end mount/teardown path with a REAL orchestrator over a mocked engine, but
 * that path never *invokes* the individual `PlayerAdapter` methods `initPlayer` builds
 * (play/pause/stop/seekTo/setVolume/mute/unmute/setPlaybackRate/getDuration/…), because
 * the real orchestrator gates them behind its `_isReady` flag. This unit test isolates
 * `initPlayer` by mocking `MediaEngine`/`PlayerOrchestrator` and by intercepting the host
 * element's `attachController` so it can capture the exact adapter object and assert that
 * each method delegates to the orchestrator/engine as documented — exercising the adapter
 * closure bodies directly.
 */
import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import type { PlayerAdapter } from '@typings/adapters.types';

// Captured on each `PlayerOrchestrator` construction so assertions can inspect the exact
// orchestrator `initPlayer` wired the adapter against.
let lastOrchestrator: MockOrchestrator;
// Captured on each `MediaEngine` construction (adapter forwards read-only queries here).
let lastEngine: MockEngine;
// The adapter + orchestrator passed into `attachController` — the subjects under test.
let capturedAdapter: PlayerAdapter | null = null;
let capturedOrchestrator: unknown = null;

type MockEngine = {
  stop: jest.Mock;
  getDuration: jest.Mock;
  getCurrentTime: jest.Mock;
  getSecondsLoaded: jest.Mock;
  destroy: jest.Mock;
};

type MockOrchestrator = {
  setPlaying: jest.Mock;
  load: jest.Mock;
  seekTo: jest.Mock;
  setVolume: jest.Mock;
  setMuted: jest.Mock;
  setPlaybackRate: jest.Mock;
  destroy: jest.Mock;
};

jest.mock('@media-engine', () => ({
  MediaEngine: jest.fn().mockImplementation(() => {
    lastEngine = {
      stop: jest.fn(),
      getDuration: jest.fn().mockReturnValue(120),
      getCurrentTime: jest.fn().mockReturnValue(42),
      getSecondsLoaded: jest.fn().mockReturnValue(60),
      destroy: jest.fn(),
    };
    return lastEngine;
  }),
}));

jest.mock('@player-orchestrator', () => ({
  PlayerOrchestrator: jest.fn().mockImplementation(() => {
    lastOrchestrator = {
      setPlaying: jest.fn(),
      load: jest.fn(),
      seekTo: jest.fn(),
      setVolume: jest.fn(),
      setMuted: jest.fn(),
      setPlaybackRate: jest.fn(),
      destroy: jest.fn(),
    };
    return lastOrchestrator;
  }),
}));

import { initPlayer, registerPlayerstackElements } from '@vanilla';

describe('Vanilla_Build — initPlayer adapter wiring (Req 6.1, 6.2)', () => {
  let attachSpy: jest.SpiedFunction<typeof PlayerstackMediaController.prototype.attachController>;

  beforeEach(() => {
    capturedAdapter = null;
    capturedOrchestrator = null;
    document.body.innerHTML = '';
    jest.clearAllMocks();
    // Intercept attachController so `initPlayer` fully runs (building the real adapter) but the
    // real MediaController (which would subscribe to the mocked orchestrator) is never created.
    attachSpy = jest
      .spyOn(PlayerstackMediaController.prototype, 'attachController')
      .mockImplementation(function (params: { adapter: PlayerAdapter; orchestrator: unknown }) {
        capturedAdapter = params.adapter;
        capturedOrchestrator = params.orchestrator;
      });
  });

  afterEach(() => {
    attachSpy.mockRestore();
  });

  function mount(config?: Parameters<typeof initPlayer>[1]): void {
    const container = document.createElement('div');
    document.body.appendChild(container);
    initPlayer(container, config);
  }

  it('re-exports registerPlayerstackElements from the vanilla entry', () => {
    expect(typeof registerPlayerstackElements).toBe('function');
  });

  it('wires the orchestrator instance into attachController', () => {
    mount();
    expect(capturedOrchestrator).toBe(lastOrchestrator);
    expect(capturedAdapter).not.toBeNull();
  });

  describe('adapter methods delegate to orchestrator/engine', () => {
    it('play() → orchestrator.setPlaying(true)', () => {
      mount();
      capturedAdapter!.play();
      expect(lastOrchestrator.setPlaying).toHaveBeenCalledWith(true);
    });

    it('pause() → orchestrator.setPlaying(false)', () => {
      mount();
      capturedAdapter!.pause();
      expect(lastOrchestrator.setPlaying).toHaveBeenCalledWith(false);
    });

    it('stop() → engine.stop()', () => {
      mount();
      capturedAdapter!.stop!();
      expect(lastEngine.stop).toHaveBeenCalledTimes(1);
    });

    it('load(url) → orchestrator.load(url)', () => {
      mount();
      capturedAdapter!.load('clip.mp4');
      expect(lastOrchestrator.load).toHaveBeenCalledWith('clip.mp4');
    });

    it('seekTo(seconds, keepPlaying) → orchestrator.seekTo(seconds, keepPlaying)', () => {
      mount();
      capturedAdapter!.seekTo(30, true);
      expect(lastOrchestrator.seekTo).toHaveBeenCalledWith(30, true);
    });

    it('setVolume(v) → orchestrator.setVolume(v)', () => {
      mount();
      capturedAdapter!.setVolume(0.5);
      expect(lastOrchestrator.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('mute() → orchestrator.setMuted(true)', () => {
      mount();
      capturedAdapter!.mute!();
      expect(lastOrchestrator.setMuted).toHaveBeenCalledWith(true);
    });

    it('unmute() → orchestrator.setMuted(false)', () => {
      mount();
      capturedAdapter!.unmute!();
      expect(lastOrchestrator.setMuted).toHaveBeenCalledWith(false);
    });

    it('setPlaybackRate(rate) → orchestrator.setPlaybackRate(rate)', () => {
      mount();
      capturedAdapter!.setPlaybackRate!(1.5);
      expect(lastOrchestrator.setPlaybackRate).toHaveBeenCalledWith(1.5);
    });

    it('getDuration() → engine.getDuration()', () => {
      mount();
      expect(capturedAdapter!.getDuration!()).toBe(120);
      expect(lastEngine.getDuration).toHaveBeenCalledTimes(1);
    });

    it('getCurrentTime() → engine.getCurrentTime()', () => {
      mount();
      expect(capturedAdapter!.getCurrentTime!()).toBe(42);
      expect(lastEngine.getCurrentTime).toHaveBeenCalledTimes(1);
    });

    it('getSecondsLoaded() → engine.getSecondsLoaded()', () => {
      mount();
      expect(capturedAdapter!.getSecondsLoaded!()).toBe(60);
      expect(lastEngine.getSecondsLoaded).toHaveBeenCalledTimes(1);
    });
  });

  describe('config.url auto-load and destroy', () => {
    it('auto-loads config.url through the adapter to the mocked orchestrator', () => {
      mount({ url: 'video.mp4' });
      expect(lastOrchestrator.load).toHaveBeenCalledWith('video.mp4');
    });

    it('destroy() tears down the orchestrator and removes the DOM nodes', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const instance = initPlayer(container, { url: 'video.mp4' });

      instance.destroy();

      expect(lastOrchestrator.destroy).toHaveBeenCalledTimes(1);
      expect(container.querySelector('playerstack-media-controller')).toBeNull();
      expect(container.querySelector('video')).toBeNull();
    });
  });
});
