import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-fullscreen-button` — the enter/exit fullscreen toggle UI_Element
 * (Req 3.3, 5.1, 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="fullscreen-button"`
 * with enter/exit glyphs), store→`data-fullscreen` propagation (Req 3.3), and the request-event
 * wiring: a click emits enter/exit fullscreen requests depending on the reflected state (Req 2.1).
 *
 * The element resolves the media context from an ancestor `playerstack-media-controller`, so
 * every test appends it as a light-DOM child of a connected controller and drives state via
 * `host.store`.
 */
registerPlayerstackElements();

/** Creates a connected controller host and a fullscreen-button child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-fullscreen-button');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-fullscreen-button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="fullscreen-button" with the enter/exit glyph spans', () => {
      const { el } = mount();
      const root = el;

      const button = root.querySelector('[part="fullscreen-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-enter-fullscreen')).not.toBeNull();
      expect(root.querySelector('.icon-exit-fullscreen')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-fullscreen from the store', () => {
      const { host, el } = mount();

      // Booleans are JSON-encoded onto the host `data-*` attribute; only a `null` reflected
      // value removes it, so a `false` state reflects as the string `"false"`.
      host.store.set({ isFullScreen: true });
      expect(el.getAttribute('data-fullscreen')).toBe('true');

      host.store.set({ isFullScreen: false });
      expect(el.getAttribute('data-fullscreen')).toBe('false');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-enter-fullscreen-request when not fullscreen', () => {
      const { host, el } = mount();
      host.store.set({ isFullScreen: false });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-enter-fullscreen-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.bubbles).toBe(true);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-exit-fullscreen-request when fullscreen', () => {
      const { host, el } = mount();
      host.store.set({ isFullScreen: true });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-exit-fullscreen-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
    });
  });
});
