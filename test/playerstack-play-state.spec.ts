import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-play-state` — the center play-state overlay UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="play-state"` overlay with a
 * `part="play-state-button"` `<button>` carrying the play/pause/replay glyph spans),
 * store→data-* propagation (`data-playing`/`data-ended`), and request-event wiring: a click
 * toggles a play or pause request based on the store `playing` state (Req 2.1).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a play-state child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-play-state');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-play-state', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract + ARIA (Req 1.5, 5.1, 5.2, 5.3)', () => {
    it('renders part="play-state" with a button and glyph spans', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="play-state"]')).not.toBeNull();
      const button = root.querySelector('[part="play-state-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(button?.getAttribute('aria-label')).toBe('Play');
      expect(root.querySelector('.icon-play')).not.toBeNull();
      expect(root.querySelector('.icon-pause')).not.toBeNull();
      expect(root.querySelector('.icon-replay')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-playing and data-ended from the store', () => {
      const { host, el } = mount();

      host.store.set({ playing: true, isEnded: false });
      expect(el.getAttribute('data-playing')).toBe('true');
      expect(el.getAttribute('data-ended')).toBe('false');

      host.store.set({ playing: false, isEnded: true });
      expect(el.getAttribute('data-playing')).toBe('false');
      expect(el.getAttribute('data-ended')).toBe('true');
    });
  });

  describe('center-overlay visibility gate (Req 3.3) — data-showing', () => {
    it('does NOT show (no data-showing) while the video is playing, so it never blocks clicks', () => {
      const { host, el } = mount();

      host.store.set({ playing: true, isEnded: false, isLoading: false, isBuffering: false, kernelError: null });

      // Regression for the reported bug: during playback the center overlay must be hidden and
      // click-through (the CSS keys visibility + pointer-events off `[data-showing="true"]`).
      expect(el.getAttribute('data-showing')).toBeNull();
    });

    it('shows (data-showing="true") when paused and idle', () => {
      const { host, el } = mount();

      host.store.set({ playing: false, isEnded: false, isLoading: false, isBuffering: false, kernelError: null });
      expect(el.getAttribute('data-showing')).toBe('true');
    });

    it('shows when ended', () => {
      const { host, el } = mount();

      host.store.set({ playing: false, isEnded: true, isLoading: false, isBuffering: false, kernelError: null });
      expect(el.getAttribute('data-showing')).toBe('true');
    });

    it('stays hidden while loading or buffering even when paused (spinner owns that state)', () => {
      const { host, el } = mount();

      host.store.set({ playing: false, isLoading: true, isBuffering: false, isEnded: false, kernelError: null });
      expect(el.getAttribute('data-showing')).toBeNull();

      host.store.set({ playing: false, isLoading: false, isBuffering: true, isEnded: false, kernelError: null });
      expect(el.getAttribute('data-showing')).toBeNull();
    });

    it('stays hidden while a kernel status message is active', () => {
      const { host, el } = mount();

      host.store.set({
        playing: false,
        isLoading: false,
        isBuffering: false,
        isEnded: false,
        kernelError: { message: 'stuck' } as never,
      });
      expect(el.getAttribute('data-showing')).toBeNull();
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits a play request when paused', () => {
      const { host, el } = mount();
      host.store.set({ playing: false });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-play-request', (e) => received.push(e as CustomEvent));

      (el).querySelector<HTMLButtonElement>('[part="play-state-button"]')?.click();

      expect(received).toHaveLength(1);
    });

    it('emits a pause request when playing', () => {
      const { host, el } = mount();
      host.store.set({ playing: true });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-pause-request', (e) => received.push(e as CustomEvent));

      (el).querySelector<HTMLButtonElement>('[part="play-state-button"]')?.click();

      expect(received).toHaveLength(1);
    });
  });
});
