import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-spinner` — the loading/buffering overlay UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="spinner"` container with a
 * `part="spinner-indicator"` glyph), and store→display propagation: `isLoading`/`isBuffering`
 * reflect `data-loading`/`data-active` and drive the container's inline display (Req 3.3).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a spinner child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-spinner');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-spinner', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="spinner" with a part="spinner-indicator" glyph', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="spinner"]')).not.toBeNull();
      expect(root.querySelector('[part="spinner-indicator"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-loading/data-active and shows the overlay while loading', () => {
      const { host, el } = mount();

      host.store.set({ isLoading: true, isBuffering: false });

      expect(el.getAttribute('data-loading')).toBe('true');
      expect(el.getAttribute('data-active')).toBe('true');
      const container = (el).querySelector('[part="spinner"]') as HTMLElement;
      expect(container.style.display).toBe('flex');
    });

    it('hides the overlay when neither loading nor buffering', () => {
      const { host, el } = mount();

      host.store.set({ isLoading: false, isBuffering: false });

      expect(el.getAttribute('data-active')).toBe('false');
      const container = (el).querySelector('[part="spinner"]') as HTMLElement;
      expect(container.style.display).toBe('none');
    });

    it('ignores a store change received before render (pre-render guard)', () => {
      // A detached spinner has no rendered container yet; invoking onStoreChange directly
      // exercises the updateVisibility guard early-return without throwing.
      const el = document.createElement('playerstack-spinner');
      expect(() =>
        (
          el as unknown as { onStoreChange: (s: { isLoading: boolean; isBuffering: boolean }) => void }
        ).onStoreChange({ isLoading: true, isBuffering: false }),
      ).not.toThrow();
    });

    it('keeps a single spinner container across disconnect/reconnect (idempotent render)', () => {
      const { el } = mount();
      el.remove();
      document.body.appendChild(el);

      const containers = (el).querySelectorAll('[part="spinner"]');
      expect(containers).toHaveLength(1);
    });

    it('applies the store state resolved at connect (shown when already loading)', () => {
      // The store already reports loading before the spinner connects, so render reads the
      // resolved context and shows the overlay immediately (the state-present branch).
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      host.store.set({ isLoading: true });

      const el = document.createElement('playerstack-spinner');
      host.appendChild(el);

      const container = (el).querySelector('[part="spinner"]') as HTMLElement;
      expect(container.style.display).toBe('flex');
    });
  });
});
