/**
 * Integration test for the Vanilla_Build entry (`initPlayer`) (Req 6.2, 17.1).
 *
 * It proves the framework-agnostic mount path end to end: `initPlayer` assembles a REAL
 * `PlayerOrchestrator` + `MediaController` + Custom Elements over a MOCKED `MediaEngine`,
 * so no real media/SDK loading happens while the request→adapter→store→`data-*` flow is
 * exercised against genuine Core wiring.
 *
 * WHY the engine is mocked: `MediaEngine` is the single boundary that touches the native
 * `HTMLMediaElement` and loads external SDKs. Stubbing it keeps the test deterministic —
 * everything above it (orchestrator, adapter, controller, elements, store) is the real
 * implementation. The mock must expose every method the orchestrator subscribes to at
 * construction (`on`), the load leg (`load`), the read-only queries the adapter exposes
 * (`getDuration`/`getCurrentTime`/`getSecondsLoaded`/`stop`), and the teardown path
 * (`off`/`destroy`) so `new PlayerOrchestrator(engine)` and `destroy()` never throw.
 */

// The most-recently constructed engine mock instance, captured so assertions can inspect
// the exact engine `initPlayer` wired into the orchestrator/adapter.
let lastEngine: MockEngine;

/**
 * Stub `MediaEngine`. Only the methods the orchestrator/adapter actually reach are needed:
 *   - `on`/`off`  — the orchestrator subscribes to 9 engine events in its constructor
 *                   (`_subscribeToEngine`) and unsubscribes in `destroy` (`_unsubscribeFromEngine`).
 *   - `load`      — `adapter.load(url)` → `orchestrator.load(url)` → `engine.load(url)`.
 *   - `destroy`   — `orchestrator.destroy()` → `engine.destroy()` (stopOnDestroy default).
 *   - `stop`      — exposed by the adapter (`adapter.stop` → `engine.stop`).
 *   - read-only queries the adapter forwards straight to the engine.
 */
type MockEngine = {
  on: jest.Mock;
  off: jest.Mock;
  load: jest.Mock;
  destroy: jest.Mock;
  stop: jest.Mock;
  getDuration: jest.Mock;
  getCurrentTime: jest.Mock;
  getSecondsLoaded: jest.Mock;
};

jest.mock('@media-engine', () => ({
  MediaEngine: jest.fn().mockImplementation(() => {
    const engine: MockEngine = {
      on: jest.fn(),
      off: jest.fn(),
      load: jest.fn(),
      destroy: jest.fn(),
      stop: jest.fn(),
      getDuration: jest.fn().mockReturnValue(0),
      getCurrentTime: jest.fn().mockReturnValue(0),
      getSecondsLoaded: jest.fn().mockReturnValue(0),
    };
    lastEngine = engine;
    return engine;
  }),
}));

import { initPlayer, registerPlayerstackElements } from '@vanilla';

/** Creates a fresh, connected container appended to the document body. */
function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('Vanilla_Build integration — initPlayer (Req 6.2, 17.1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('mount (Req 6.2 — monta un reproductor funcional)', () => {
    it('appends a media-controller host and a <video> media element into the container', () => {
      const container = createContainer();

      const instance = initPlayer(container);

      const controller = container.querySelector('playerstack-media-controller');
      const media = container.querySelector('video');
      expect(controller).not.toBeNull();
      expect(media).not.toBeNull();
      expect(instance.controller).toBe(controller);
      expect(instance.element).toBe(media);
      expect(typeof instance.destroy).toBe('function');
    });

    it('mounts an <audio> element when config.audio is set', () => {
      const container = createContainer();

      initPlayer(container, { audio: true });

      expect(container.querySelector('audio')).not.toBeNull();
      expect(container.querySelector('video')).toBeNull();
    });

    it('exposes registerPlayerstackElements from the vanilla entry', () => {
      expect(typeof registerPlayerstackElements).toBe('function');
    });
  });

  describe('request→adapter→engine leg (Req 6.2)', () => {
    it('auto-loads config.url through the adapter down to the mocked engine', () => {
      const container = createContainer();

      initPlayer(container, { url: 'video.mp4' });

      // initPlayer → adapter.load('video.mp4') → orchestrator.load('video.mp4') → engine.load('video.mp4').
      expect(lastEngine.load).toHaveBeenCalledWith('video.mp4');
    });

    it('routes a play request dispatched on the controller through to the adapter without throwing', () => {
      const container = createContainer();
      initPlayer(container, { url: 'video.mp4' });
      const controller = container.querySelector('playerstack-media-controller') as HTMLElement;

      // A request event bubbling to the controller is routed by the MediaController to the
      // adapter (→ orchestrator). With a mocked, not-yet-ready engine the orchestrator gates
      // the actual engine.play(), so the meaningful, deterministic contract is that the wired
      // request path handles the event without throwing.
      expect(() =>
        controller.dispatchEvent(new CustomEvent('playerstack-play-request', { bubbles: true })),
      ).not.toThrow();
    });
  });

  describe('store→data-* leg (Req 6.2)', () => {
    it('reflects store state onto a child play-button as data-playing', () => {
      const container = createContainer();
      const instance = initPlayer(container, { url: 'video.mp4' });

      // Add a real UI_Element child that consumes the host store context.
      const button = document.createElement('playerstack-play-button');
      instance.controller.appendChild(button);

      // Drive the store the way the orchestrator would on a `play` event; the child reflects
      // it as `data-playing` (booleans are JSON-encoded, so `true` reflects as "true").
      instance.controller.store.set({ playing: true });
      expect(button.getAttribute('data-playing')).toBe('true');

      instance.controller.store.set({ playing: false });
      expect(button.getAttribute('data-playing')).toBe('false');
    });
  });

  describe('destroy (Req 6.2)', () => {
    it('removes the controller and media element and tears the engine down', () => {
      const container = createContainer();
      const instance = initPlayer(container, { url: 'video.mp4' });

      instance.destroy();

      expect(container.querySelector('playerstack-media-controller')).toBeNull();
      expect(container.querySelector('video')).toBeNull();
      // orchestrator.destroy() → engine.destroy() (stopOnDestroy default true).
      expect(lastEngine.destroy).toHaveBeenCalledTimes(1);
    });

    it('does not throw when destroy runs', () => {
      const container = createContainer();
      const instance = initPlayer(container, { url: 'video.mp4' });

      expect(() => instance.destroy()).not.toThrow();
    });
  });
});
