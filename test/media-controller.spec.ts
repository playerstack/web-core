import { MediaController } from '@ui/media-controller';
import { createMediaStore } from '@ui/media-store';
import { PlayerOrchestrator } from '@player-orchestrator';
import { EventEmitter } from '@event-emitter';
import type { PlayerAdapter } from '@typings/adapters.types';
import type { PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';
import type { MediaControllerConfig } from '@typings/ui/media-controller.types';

/**
 * Builds a COMPLETE mock `PlayerAdapter` whose methods are all `jest.fn()`.
 * Used to assert request→adapter routing and to satisfy `assertPlayerAdapter`.
 */
function createMockAdapter(): { [K in keyof PlayerAdapter]: jest.Mock } {
  return {
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    load: jest.fn(),
    seekTo: jest.fn(),
    setVolume: jest.fn(),
    mute: jest.fn(),
    unmute: jest.fn(),
    setPlaybackRate: jest.fn(),
    getDuration: jest.fn(),
    getCurrentTime: jest.fn(),
    getSecondsLoaded: jest.fn(),
  };
}

/**
 * Minimal fake orchestrator that reuses the real `EventEmitter` surface the
 * controller relies on (`on`/`off`/`emit`) and adds a spyable `destroy`. This
 * isolates the controller from the full `PlayerOrchestrator` wiring so tests can
 * drive playback events directly with `emit(...)`.
 */
class FakeOrchestrator extends EventEmitter<PlayerOrchestratorEvents> {
  destroy = jest.fn();
}

describe('MediaController', () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let store: ReturnType<typeof createMediaStore>;
  let orchestrator: FakeOrchestrator;
  let rootTarget: HTMLElement;
  let controller: MediaController;

  function buildController(overrides?: Partial<MediaControllerConfig>): MediaController {
    return new MediaController({
      adapter: adapter as unknown as PlayerAdapter,
      store,
      rootTarget,
      orchestrator: orchestrator as unknown as PlayerOrchestrator,
      ...overrides,
    });
  }

  beforeEach(() => {
    adapter = createMockAdapter();
    store = createMediaStore();
    orchestrator = new FakeOrchestrator();
    rootTarget = document.createElement('div');
    controller = buildController();
  });

  describe('construction — assertPlayerAdapter (Req 2.5)', () => {
    it('does not throw with a complete adapter', () => {
      expect(() => buildController()).not.toThrow();
    });

    it('throws when the adapter is missing a method (e.g. seekTo)', () => {
      const incomplete = createMockAdapter();
      // Omit a required method to make the adapter non-conformant.
      delete (incomplete as Partial<Record<keyof PlayerAdapter, unknown>>).seekTo;

      expect(() => buildController({ adapter: incomplete as unknown as PlayerAdapter })).toThrow();
    });
  });

  describe('request routing → adapter (Req 2.1, 2.2)', () => {
    it('routes play requests to adapter.play', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-play-request', { bubbles: true }));
      expect(adapter.play).toHaveBeenCalledTimes(1);
    });

    it('routes pause requests to adapter.pause', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-pause-request', { bubbles: true }));
      expect(adapter.pause).toHaveBeenCalledTimes(1);
    });

    it('routes mute requests to adapter.mute', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-mute-request', { bubbles: true }));
      expect(adapter.mute).toHaveBeenCalledTimes(1);
    });

    it('routes unmute requests to adapter.unmute', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-unmute-request', { bubbles: true }));
      expect(adapter.unmute).toHaveBeenCalledTimes(1);
    });

    it('routes seek requests with (time, keepPlaying)', () => {
      rootTarget.dispatchEvent(
        new CustomEvent('playerstack-seek-request', { bubbles: true, detail: { time: 12, keepPlaying: true } }),
      );
      expect(adapter.seekTo).toHaveBeenCalledWith(12, true);
    });

    it('routes volume requests with the ratio', () => {
      rootTarget.dispatchEvent(
        new CustomEvent('playerstack-volume-request', { bubbles: true, detail: { volume: 0.5 } }),
      );
      expect(adapter.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('routes rate requests with the playback rate', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-rate-request', { bubbles: true, detail: { rate: 2 } }));
      expect(adapter.setPlaybackRate).toHaveBeenCalledWith(2);
    });

    it('routes load requests with (url, isReady)', () => {
      rootTarget.dispatchEvent(
        new CustomEvent('playerstack-load-request', { bubbles: true, detail: { url: 'x.mp4', isReady: true } }),
      );
      expect(adapter.load).toHaveBeenCalledWith('x.mp4', true);
    });

    it('ignores a malformed seek request (missing detail) without throwing', () => {
      expect(() =>
        rootTarget.dispatchEvent(new CustomEvent('playerstack-seek-request', { bubbles: true })),
      ).not.toThrow();
      expect(adapter.seekTo).not.toHaveBeenCalled();
    });

    it('ignores a malformed volume request (missing detail) without calling the adapter', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-volume-request', { bubbles: true }));
      expect(adapter.setVolume).not.toHaveBeenCalled();
    });

    it('ignores a malformed load request (missing detail) without calling the adapter', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-load-request', { bubbles: true }));
      expect(adapter.load).not.toHaveBeenCalled();
    });

    it('ignores a malformed rate request (missing detail) without calling the adapter', () => {
      rootTarget.dispatchEvent(new CustomEvent('playerstack-rate-request', { bubbles: true }));
      expect(adapter.setPlaybackRate).not.toHaveBeenCalled();
    });
  });

  describe('orchestrator events → store (Req 2.3)', () => {
    it('sets playing=true on play', () => {
      orchestrator.emit('play');
      expect(store.getState().playing).toBe(true);
    });

    it('sets playing=false on pause', () => {
      orchestrator.emit('play');
      orchestrator.emit('pause');
      expect(store.getState().playing).toBe(false);
    });

    it('updates duration on duration', () => {
      orchestrator.emit('duration', 120);
      expect(store.getState().duration).toBe(120);
    });

    it('clears isLoading on ready', () => {
      orchestrator.emit('ready');
      expect(store.getState().isLoading).toBe(false);
    });

    it('sets isEnded=true and playing=false on ended', () => {
      orchestrator.emit('play');
      orchestrator.emit('ended');
      const state = store.getState();
      expect(state.isEnded).toBe(true);
      expect(state.playing).toBe(false);
    });

    it('updates seek position on seek', () => {
      orchestrator.emit('seek', 30);
      expect(store.getState().seek).toBe(30);
    });

    it('updates isLoading on loading', () => {
      orchestrator.emit('loading', true);
      expect(store.getState().isLoading).toBe(true);
    });

    it('maps progress payload onto played/loaded/seek', () => {
      orchestrator.emit('progress', {
        played: 0.5,
        loaded: 0.7,
        playedSeconds: 60,
        loadedSeconds: 80,
        bufferedRanges: [],
      });
      const state = store.getState();
      expect(state.played).toBe(0.5);
      expect(state.loaded).toBe(0.7);
      expect(state.seek).toBe(60);
    });

    it('handles the liveEnded event without throwing or mutating state', () => {
      // `liveEnded` is subscribed as a no-op (no PlayerState field to update on live→VOD).
      // Emitting it exercises that subscription's handler and must not change the store.
      const before = store.getState();
      expect(() => orchestrator.emit('liveEnded')).not.toThrow();
      expect(store.getState()).toEqual(before);
    });
  });

  describe('destroy() cleanup (Req 17.5)', () => {
    it('stops routing request events to the adapter after destroy', () => {
      controller.destroy();
      rootTarget.dispatchEvent(new CustomEvent('playerstack-play-request', { bubbles: true }));
      expect(adapter.play).not.toHaveBeenCalled();
    });

    it('stops propagating orchestrator events to the store after destroy', () => {
      controller.destroy();
      orchestrator.emit('duration', 999);
      expect(store.getState().duration).toBe(0);
    });

    it('destroys the orchestrator', () => {
      controller.destroy();
      expect(orchestrator.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
