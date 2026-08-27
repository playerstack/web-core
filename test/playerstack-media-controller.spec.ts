import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import { requestMediaContext } from '@ui/media-context';
import type { MediaContext } from '@typings/ui/media-context.types';

/**
 * Spec for `playerstack-media-controller` — the ROOT host element (Req 5.1, 5.3). In the
 * light-DOM model the controller renders NO structural markup of its own: it is the
 * positioned stage and its composed `playerstack-*` children are real light-DOM children.
 * This verifies it does NOT inject a competing wrapper/slot, the single global token
 * injection per document (Req 3.10), the media-context wiring it provides to descendants
 * (Req 2.2/2.3), and that its `store` getter returns a working `MediaStore`.
 *
 * Registration goes through `registerPlayerstackElements()` so we also exercise the
 * default-table path (the table now includes this element). The registry forbids
 * re-defining a name, so registration is idempotent and safe to call once at module load.
 */
registerPlayerstackElements();

/** Convenience: create the upgraded, defined element instance typed. */
function createController(): PlayerstackMediaController {
  return document.createElement('playerstack-media-controller') as PlayerstackMediaController;
}

describe('playerstack-media-controller', () => {
  beforeEach(() => {
    // Remove the once-per-document global tokens marker so the "exactly once" assertions
    // in the tokens test are deterministic regardless of test ordering.
    document.head.querySelectorAll('style[data-playerstack-tokens]').forEach((node) => node.remove());
  });

  afterEach(() => {
    // Clean up any nodes left on the document body between tests.
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.3)', () => {
    it('has no Shadow DOM and injects no structural wrapper or <slot> into its light DOM', () => {
      const el = createController();
      document.body.appendChild(el);

      // Light DOM only: there is no shadow root.
      expect(el.shadowRoot).toBeNull();
      // The controller renders nothing structural of its own — no wrapper/slot that would
      // duplicate or hide the composed light-DOM children.
      expect(el.querySelector('[part="root"]')).toBeNull();
      expect(el.querySelector('slot')).toBeNull();
      expect(el.innerHTML).toBe('');
    });

    it('preserves its composed light-DOM children instead of wrapping them', () => {
      const el = createController();
      const child = document.createElement('playerstack-play-button');
      el.appendChild(child);
      document.body.appendChild(el);

      // The child stays a direct light-DOM child of the controller (real descendant).
      expect(child.parentElement).toBe(el);
      expect(el.children).toHaveLength(1);
    });
  });

  describe('global tokens injected exactly once per document (Req 3.10)', () => {
    it('injects a single tokens marker after connecting one controller', () => {
      const el = createController();
      document.body.appendChild(el);

      expect(document.head.querySelectorAll('style[data-playerstack-tokens]')).toHaveLength(1);
    });

    it('stays at exactly one tokens marker after connecting a second controller (idempotent)', () => {
      const first = createController();
      document.body.appendChild(first);
      expect(document.head.querySelectorAll('style[data-playerstack-tokens]')).toHaveLength(1);

      const second = createController();
      document.body.appendChild(second);

      // ensureGlobalTokens is once-per-document: a second host must not duplicate the marker.
      expect(document.head.querySelectorAll('style[data-playerstack-tokens]')).toHaveLength(1);
    });
  });

  describe('media context wiring (Req 2.2, 2.3)', () => {
    it('provides its own store to a descendant that requests the media context', () => {
      const el = createController();
      document.body.appendChild(el);

      // A plain descendant inside the controller requests context; the bubbling + composed
      // request event reaches the controller, which provides its shared store.
      const child = document.createElement('div');
      el.appendChild(child);

      let resolved: MediaContext | null = null;
      requestMediaContext(child, (context) => {
        resolved = context;
      });

      expect(resolved).not.toBeNull();
      expect((resolved as unknown as MediaContext).store).toBe(el.store);
    });
  });

  describe('attachController re-attach + render idempotency', () => {
    /** A conformant no-op adapter satisfying assertPlayerAdapter. */
    function makeAdapter(): Record<string, () => unknown> {
      const noop = (): void => undefined;
      return {
        play: noop,
        pause: noop,
        stop: noop,
        load: noop,
        seekTo: noop,
        setVolume: noop,
        mute: noop,
        unmute: noop,
        setPlaybackRate: noop,
        getDuration: () => 0,
        getCurrentTime: () => 0,
        getSecondsLoaded: () => 0,
      };
    }

    /** A minimal orchestrator stub exposing the on/off/destroy the MediaController uses. */
    function makeOrchestrator(): { on: jest.Mock; off: jest.Mock; destroy: jest.Mock } {
      return { on: jest.fn(), off: jest.fn(), destroy: jest.fn() };
    }

    it('destroys the previously attached controller when attachController is called again', () => {
      const el = createController();
      document.body.appendChild(el);

      const firstOrchestrator = makeOrchestrator();
      el.attachController({
        adapter: makeAdapter() as never,
        orchestrator: firstOrchestrator as never,
      });

      const secondOrchestrator = makeOrchestrator();
      // Re-attaching destroys the first controller (which destroys the first orchestrator).
      el.attachController({
        adapter: makeAdapter() as never,
        orchestrator: secondOrchestrator as never,
      });

      expect(firstOrchestrator.destroy).toHaveBeenCalledTimes(1);
    });

    it('keeps its light DOM untouched across disconnect/reconnect (idempotent render)', () => {
      const el = createController();
      const child = document.createElement('playerstack-play-button');
      el.appendChild(child);
      document.body.appendChild(el);
      el.remove();
      document.body.appendChild(el);

      // Render is a no-op: the composed child remains the sole light-DOM child, unduplicated.
      expect(el.children).toHaveLength(1);
      expect(el.firstElementChild).toBe(child);
    });
  });

  describe('controller-scoped state reflection (Req 3.3)', () => {
    it('reflects data-fullscreen on the host from the store so stage-wide fullscreen CSS resolves', () => {
      const el = createController();
      document.body.appendChild(el);

      // Not fullscreen by default: the attribute is ABSENT so the CSS uses `[data-fullscreen]`
      // presence (mirroring the original boolean `isFullscreen` gate).
      expect(el.hasAttribute('data-fullscreen')).toBe(false);

      el.store.set({ isFullScreen: true });
      expect(el.getAttribute('data-fullscreen')).toBe('true');

      // Leaving fullscreen REMOVES the attribute (rather than setting `"false"`), keeping the
      // stage-wide `playerstack-media-controller[data-fullscreen] ...` sizing off.
      el.store.set({ isFullScreen: false });
      expect(el.hasAttribute('data-fullscreen')).toBe(false);
    });

    it('reflects data-time-sliding on the host from the store `seeking` flag so the slider stays revealed while scrubbing', () => {
      const el = createController();
      document.body.appendChild(el);

      // Not scrubbing by default: the attribute is ABSENT so the CSS keys off presence
      // (mirroring the original `timeSliding`/`isSliding` boolean gate threaded from the root).
      expect(el.hasAttribute('data-time-sliding')).toBe(false);

      el.store.set({ seeking: true });
      expect(el.getAttribute('data-time-sliding')).toBe('true');

      // Releasing the scrub REMOVES the attribute so the rail/handle/tooltip fall back to the
      // hover/focus paths.
      el.store.set({ seeking: false });
      expect(el.hasAttribute('data-time-sliding')).toBe(false);
    });
  });

  describe('store getter (Req 2.3)', () => {
    it('returns a working MediaStore with getState/set/subscribe', () => {
      const el = createController();
      document.body.appendChild(el);

      const { store } = el;
      expect(typeof store.getState).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.subscribe).toBe('function');

      const seen: boolean[] = [];
      const unsubscribe = store.subscribe((state) => seen.push(state.playing));
      store.set({ playing: true });

      expect(store.getState().playing).toBe(true);
      expect(seen).toContain(true);

      unsubscribe();
    });
  });
});
