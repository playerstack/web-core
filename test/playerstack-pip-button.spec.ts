import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-pip-button` — the enter/exit Picture-in-Picture toggle UI_Element
 * (Req 3.3, 5.1, 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="pip-button"` with
 * enter/exit glyphs), store→`data-pip` propagation (Req 3.3), and the request-event wiring:
 * a click emits enter/exit PiP requests depending on the reflected state (Req 2.1).
 *
 * The element resolves the media context from an ancestor `playerstack-media-controller`, so
 * every test appends it as a light-DOM child of a connected controller and drives state via
 * `host.store`.
 */
registerPlayerstackElements();

/** Creates a connected controller host and a pip-button child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-pip-button');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-pip-button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="pip-button" with the enter/exit glyph spans', () => {
      const { el } = mount();
      const root = el;

      const button = root.querySelector('[part="pip-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-enter-pip')).not.toBeNull();
      expect(root.querySelector('.icon-exit-pip')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-pip from the store', () => {
      const { host, el } = mount();

      // Booleans are JSON-encoded onto the host `data-*` attribute; only a `null` reflected
      // value removes it, so a `false` state reflects as the string `"false"`.
      host.store.set({ isPIP: true });
      expect(el.getAttribute('data-pip')).toBe('true');

      host.store.set({ isPIP: false });
      expect(el.getAttribute('data-pip')).toBe('false');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-enter-pip-request when not in PiP', () => {
      const { host, el } = mount();
      host.store.set({ isPIP: false });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-enter-pip-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="pip-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.bubbles).toBe(true);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-exit-pip-request when in PiP', () => {
      const { host, el } = mount();
      host.store.set({ isPIP: true });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-exit-pip-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="pip-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
    });
  });
});
