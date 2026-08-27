import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { AdsConfig } from '@typings/adapters.types';

/**
 * Spec for `playerstack-ad-overlay` — the ad overlay UI_Element that owns a headless
 * `AdsController` (Req 3.3, 5.1, 5.2, 5.3, 17.5). It verifies the Markup_Contract
 * (`part="ad-overlay"` with `ad-skip-button`/`ad-progress`/`ad-click`), controller-driven
 * activation and progress from the store, and request-event wiring: once skippable, clicking
 * the skip button invokes the configured `onSkip` AND dispatches `playerstack-ad-skip`
 * (Req 2.1). `AdsController.update` is synchronous, so no fake timers are needed.
 */
registerPlayerstackElements();

/** Creates a connected controller host and an ad-overlay child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-ad-overlay');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-ad-overlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract + ARIA (Req 1.5, 5.1, 5.2, 5.3)', () => {
    it('renders part="ad-overlay" with skip button, progress and click regions', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="ad-overlay"]')).not.toBeNull();
      const skip = root.querySelector('[part="ad-skip-button"]');
      expect(skip).not.toBeNull();
      expect(skip?.getAttribute('type')).toBe('button');
      expect(skip?.getAttribute('aria-label')).toBe('Skip ad');
      expect(root.querySelector('[part="ad-click"]')).not.toBeNull();
    });

    // Regression (double timeline): the overlay must NOT render its own `[part='ad-progress']`
    // bar — the normal time-slider (yellow in ad mode) is the SINGLE ad progress bar, matching
    // the original. A second bar here caused the DOUBLE-timeline bug.
    it('does NOT render a separate ad-progress bar (single timeline via the time-slider)', () => {
      const { el } = mount();
      expect((el).querySelector('[part="ad-progress"]')).toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('controller-driven activation + skip wiring (Req 2.1, 3.3)', () => {
    it('activates, updates progress, enables skip and dispatches ad-skip + invokes onSkip', () => {
      const { host, el } = mount();
      const onSkip = jest.fn();
      const config: AdsConfig = { skipAfter: 2, onSkip, onAdClick: jest.fn() };
      (el as unknown as { ads: AdsConfig }).ads = config;

      // First play activates the pre-roll (notifyPlay fires once), then a progress update
      // past `skipAfter` makes the ad skippable.
      host.store.set({ playing: true });
      host.store.set({ seek: 3, duration: 10 });

      expect(el.getAttribute('data-active')).toBe('true');
      expect(el.getAttribute('data-can-skip')).toBe('true');

      const overlay = (el).querySelector('[part="ad-overlay"]') as HTMLElement;
      expect(overlay.style.display).not.toBe('none');

      const skipButton = (el).querySelector('[part="ad-skip-button"]') as HTMLButtonElement;
      expect(skipButton.disabled).toBe(false);

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-ad-skip', (e) => received.push(e as CustomEvent));

      skipButton.click();

      // Request/Response (A6): the element ONLY dispatches the intent. It must NOT invoke the
      // consumer's `ads.onSkip` itself — the skin does that when it consumes the event (invoking
      // it here too would double-fire the consumer callback).
      expect(received).toHaveLength(1);
      expect(onSkip).not.toHaveBeenCalled();
    });

    it('dispatches playerstack-ad-click WITHOUT invoking the consumer callback (skin owns it)', () => {
      const { host, el } = mount();
      const onAdClick = jest.fn();
      const config: AdsConfig = { skipAfter: 2, onSkip: jest.fn(), onAdClick };
      (el as unknown as { ads: AdsConfig }).ads = config;

      host.store.set({ playing: true });
      host.store.set({ seek: 1, duration: 10 });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-ad-click', (e) => received.push(e as CustomEvent));

      const clickRegion = (el).querySelector('[part="ad-click"]') as HTMLElement;
      clickRegion.click();

      // Only the request event fires; the skin (not the element) invokes `ads.onAdClick` +
      // opens the URL, so the element must not call it directly (would double-fire).
      expect(received).toHaveLength(1);
      expect(onAdClick).not.toHaveBeenCalled();
    });

    // Regression (skip label): before the ad is skippable the affordance shows ONLY the
    // remaining seconds (a number), NOT "Skip ad (N)"; once skippable it shows "Skip ad".
    it('shows only the countdown number before skippable, then the "Skip ad" label', () => {
      const { host, el } = mount();
      const config: AdsConfig = { skipAfter: 5, onSkip: jest.fn(), onAdClick: jest.fn() };
      (el as unknown as { ads: AdsConfig }).ads = config;

      host.store.set({ playing: true });
      // Not yet skippable: 2s of a 10s ad, skipAfter 5 → countdown shows a bare number.
      host.store.set({ seek: 2, duration: 10 });
      const skipButton = (el).querySelector('[part="ad-skip-button"]') as HTMLButtonElement;
      expect(skipButton.disabled).toBe(true);
      expect(skipButton.textContent).toMatch(/^\d+$/);
      expect(skipButton.textContent).not.toContain('Skip ad');

      // Past skipAfter → skippable: label is exactly "Skip ad" (no number).
      host.store.set({ seek: 6, duration: 10 });
      expect(skipButton.disabled).toBe(false);
      expect(skipButton.textContent).toBe('Skip ad');
    });

    // Parity with the original StyledSkipPreviewImage: during the countdown the skip affordance
    // shows the ORIGINAL video's poster next to the number; once skippable the preview hides.
    it('shows the original-video poster preview during the countdown and hides it once skippable', () => {
      const { host, el } = mount();
      const config: AdsConfig = { skipAfter: 5, onSkip: jest.fn(), onAdClick: jest.fn() };
      (el as unknown as { ads: AdsConfig }).ads = config;
      (el as unknown as { poster: string }).poster = 'https://example.com/poster.webp';

      host.store.set({ playing: true });
      host.store.set({ seek: 2, duration: 10 }); // not skippable → countdown

      const countdown = el.querySelector('[part="ad-skip-countdown"]') as HTMLElement;
      const preview = el.querySelector('[part="ad-skip-preview"]') as HTMLImageElement;
      expect(countdown).not.toBeNull();
      expect(countdown.textContent).toMatch(/^\d+$/);
      expect(preview.style.display).not.toBe('none');
      expect(preview.getAttribute('src')).toBe('https://example.com/poster.webp');

      // Skippable → the preview hides and the label reads "Skip ad".
      host.store.set({ seek: 6, duration: 10 });
      expect(preview.style.display).toBe('none');
      expect(countdown.textContent).toBe('Skip ad');
    });

    it('does not show the skip preview when no poster is provided', () => {
      const { host, el } = mount();
      const config: AdsConfig = { skipAfter: 5, onSkip: jest.fn(), onAdClick: jest.fn() };
      (el as unknown as { ads: AdsConfig }).ads = config;

      host.store.set({ playing: true });
      host.store.set({ seek: 2, duration: 10 });

      const preview = el.querySelector('[part="ad-skip-preview"]') as HTMLImageElement;
      expect(preview.style.display).toBe('none');
      expect(preview.getAttribute('src')).toBeNull();
    });

    it('hides the overlay and clears state when the ad completes', () => {
      const { host, el } = mount();
      const onAdComplete = jest.fn();
      const config: AdsConfig = { skipAfter: 2, onSkip: jest.fn(), onAdClick: jest.fn(), onAdComplete };
      (el as unknown as { ads: AdsConfig }).ads = config;

      host.store.set({ playing: true });
      host.store.set({ seek: 5, duration: 10 });
      // Reaching the end completes the ad (isEnded) → adCompleted hides the overlay.
      host.store.set({ seek: 10, duration: 10, isEnded: true });

      const overlay = (el).querySelector('[part="ad-overlay"]') as HTMLElement;
      expect(overlay.style.display).toBe('none');
      expect(el.getAttribute('data-active')).toBeNull();
    });
  });

  describe('render idempotency', () => {
    it('keeps a single ad-overlay across disconnect/reconnect', () => {
      const { el } = mount();
      el.remove();
      // Reconnect under a fresh host so the base class re-runs render (guard early-returns).
      const host2 = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host2);
      host2.appendChild(el);

      const overlays = (el).querySelectorAll('[part="ad-overlay"]');
      expect(overlays).toHaveLength(1);
    });
  });
});
