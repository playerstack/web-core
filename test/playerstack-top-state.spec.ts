import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import { getTranslations } from '@i18n/index';

/**
 * Spec for `playerstack-top-state` — the top status-message region UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="top-state"` with a
 * `part="top-state-message"` region), i18n resolution via the `language` attribute, and
 * store→display propagation: a kernel error surfaces the localized "playback stuck" message
 * and reflects `data-active`; clearing the error empties the region (Req 3.3).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a top-state child wired to its store. */
function mount(language?: string): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-top-state');
  if (language !== undefined) {
    el.setAttribute('language', language);
  }
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-top-state', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="top-state" with a part="top-state-message" region', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="top-state"]')).not.toBeNull();
      expect(root.querySelector('[part="top-state-message"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { host, el } = mount('en');
      host.store.set({ kernelError: new Error('x') });
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→display propagation (Req 3.3)', () => {
    it('surfaces the localized error message and reflects data-active on kernelError', () => {
      const { host, el } = mount('en');

      host.store.set({ kernelError: new Error('x') });

      const message = (el).querySelector('[part="top-state-message"]');
      expect(message?.textContent).toBe(getTranslations('en').playbackStuckClickResumePlayback);
      expect(el.getAttribute('data-active')).toBe('true');
    });

    it('keeps the region empty and inactive with no error', () => {
      const { host, el } = mount('en');

      host.store.set({ kernelError: null });

      const message = (el).querySelector('[part="top-state-message"]');
      expect(message?.textContent).toBe('');
      expect(el.getAttribute('data-active')).toBe('false');
    });
  });
});
