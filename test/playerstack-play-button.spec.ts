import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-play-button` — the play/pause toggle UI_Element (Req 3.3, 5.1, 5.2,
 * 5.3, 17.5). It verifies:
 *  - Markup_Contract: the `part="play-button"` `<button>` with the play/pause glyph spans.
 *  - store→data-* propagation: `data-playing` reflected from the shared store (Req 3.3).
 *  - request-event wiring: a click emits `playerstack-play-request` when paused and
 *    `playerstack-pause-request` when playing (Req 2.1).
 *
 * The element resolves the media context from an ancestor `playerstack-media-controller`, so
 * every test appends it as a light-DOM child of a connected controller and drives state via
 * `host.store`. Registration goes through `registerPlayerstackElements()` (idempotent).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a play-button child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-play-button');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-play-button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="play-button" with the play/pause glyph spans', () => {
      const { el } = mount();
      const root = el;

      const button = root.querySelector('[part="play-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-play')).not.toBeNull();
      expect(root.querySelector('.icon-pause')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-playing from the store', () => {
      const { host, el } = mount();

      // Booleans are JSON-encoded onto the host `data-*` attribute; only a `null` reflected
      // value removes it, so a `false` state reflects as the string `"false"`.
      host.store.set({ playing: true });
      expect(el.getAttribute('data-playing')).toBe('true');

      host.store.set({ playing: false });
      expect(el.getAttribute('data-playing')).toBe('false');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-play-request when paused', () => {
      const { host, el } = mount();
      host.store.set({ playing: false });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-play-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="play-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.bubbles).toBe(true);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-pause-request when playing', () => {
      const { host, el } = mount();
      host.store.set({ playing: true });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-pause-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="play-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
    });
  });
});
