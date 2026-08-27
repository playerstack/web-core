import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import type { PlayerstackMobileSettings } from '@ui/elements/playerstack-mobile-settings';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-mobile-settings` — the full-surface mobile settings panel. It verifies
 * the Markup_Contract (panel/header/grid/switch/subpage/option parts), open/close + sub-page
 * navigation, the current-value labels on the switch cards, ad-mode gating (Speed dropped), and
 * the request-event wiring on option selection (rate/quality/caption).
 */
registerPlayerstackElements();

function mount(): { host: PlayerstackMediaController; el: PlayerstackMobileSettings } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-mobile-settings') as PlayerstackMobileSettings;
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-mobile-settings', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract', () => {
    it('renders the panel, header (back/title/close) and the main grid + subpage', () => {
      const { el } = mount();
      expect(el.querySelector('[part="mobile-settings-panel"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-header"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-back"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-title"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-close"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-grid"]')).not.toBeNull();
      expect(el.querySelector('[part="mobile-settings-subpage"]')).not.toBeNull();
    });

    it('matches the rendered markup snapshot', () => {
      const { el } = mount();
      expect(el.innerHTML).toMatchSnapshot();
    });
  });

  describe('open/close + reflected state', () => {
    it('reflects data-settings-open on open() and clears it on close()', () => {
      const { el } = mount();
      expect(el.getAttribute('data-settings-open')).toBeNull();

      el.open_();
      expect(el.getAttribute('data-settings-open')).toBe('true');

      el.close();
      expect(el.getAttribute('data-settings-open')).toBeNull();
    });
  });

  describe('switch cards (main page)', () => {
    it('shows Speed always (no ad) and Quality/Captions only when provided', () => {
      const { el } = mount();
      el.qualityOptions = [{ label: '1080p', value: '1080' }];
      el.captions = [{ label: 'English', language: 'en' }];

      const cats = Array.from(el.querySelectorAll('[part="mobile-settings-switch"]')).map((c) =>
        c.getAttribute('data-category'),
      );
      expect(cats).toEqual(['quality', 'speed', 'captions']);
    });

    it('shows the current value on each switch card from the store', () => {
      const { host, el } = mount();
      el.qualityOptions = [{ label: '720p', value: '720' }];
      host.store.set({ playbackRate: 2, playbackQuality: 720 });

      const speedCard = el.querySelector('[part="mobile-settings-switch"][data-category="speed"]');
      const qualityCard = el.querySelector('[part="mobile-settings-switch"][data-category="quality"]');
      expect(speedCard?.querySelector('[part="mobile-settings-switch-value"]')?.textContent).toBe('2');
      expect(qualityCard?.querySelector('[part="mobile-settings-switch-value"]')?.textContent).toBe('720p');
    });

    it('drops the Speed card in ad mode', () => {
      const { el } = mount();
      el.qualityOptions = [{ label: '1080p', value: '1080' }];
      el.adMode = true;
      const cats = Array.from(el.querySelectorAll('[part="mobile-settings-switch"]')).map((c) =>
        c.getAttribute('data-category'),
      );
      expect(cats).not.toContain('speed');
      expect(cats).toContain('quality');
    });

    it('drops the Speed card on a live stream (speed not applicable to live)', () => {
      const { el } = mount();
      el.qualityOptions = [{ label: '1080p', value: '1080' }];
      el.live = true;
      const cats = Array.from(el.querySelectorAll('[part="mobile-settings-switch"]')).map((c) =>
        c.getAttribute('data-category'),
      );
      expect(cats).not.toContain('speed');
      expect(cats).toContain('quality');
    });
  });

  describe('sub-page navigation + selection', () => {
    it('opens a sub-page on a card click (data-subpage) and back returns to main', () => {
      const { el } = mount();
      el.open_();
      const speedCard = el.querySelector('[part="mobile-settings-switch"][data-category="speed"]') as HTMLButtonElement;
      speedCard.click();
      expect(el.getAttribute('data-subpage')).toBe('speed');
      expect(el.querySelectorAll('[part="mobile-settings-option"]').length).toBe(7);

      const back = el.querySelector('[part="mobile-settings-back"]') as HTMLButtonElement;
      back.click();
      expect(el.getAttribute('data-subpage')).toBeNull();
    });

    it('marks the active option from the store', () => {
      const { host, el } = mount();
      host.store.set({ playbackRate: 1.5 });
      el.open_();
      (el.querySelector('[part="mobile-settings-switch"][data-category="speed"]') as HTMLButtonElement).click();
      const active = el.querySelector('[part="mobile-settings-option"][data-active="true"]');
      expect(active?.getAttribute('data-value')).toBe('1.5');
    });

    it('emits playerstack-rate-request on a speed option and closes', () => {
      const { el } = mount();
      el.open_();
      (el.querySelector('[part="mobile-settings-switch"][data-category="speed"]') as HTMLButtonElement).click();

      const received: Array<CustomEvent<{ rate: number }>> = [];
      document.addEventListener('playerstack-rate-request', (e) => received.push(e as CustomEvent<{ rate: number }>));

      const opt = el.querySelector('[part="mobile-settings-option"][data-value="2"]') as HTMLButtonElement;
      opt.click();
      expect(received[0]?.detail.rate).toBe(2);
      expect(el.getAttribute('data-settings-open')).toBeNull();
    });

    it('emits playerstack-quality-request on a quality option', () => {
      const { el } = mount();
      el.qualityOptions = [
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
      ];
      el.open_();
      (el.querySelector('[part="mobile-settings-switch"][data-category="quality"]') as HTMLButtonElement).click();

      const received: Array<CustomEvent<{ value: string }>> = [];
      document.addEventListener('playerstack-quality-request', (e) =>
        received.push(e as CustomEvent<{ value: string }>),
      );
      const opt = el.querySelector('[part="mobile-settings-option"][data-value="720"]') as HTMLButtonElement;
      opt.click();
      expect(received[0]?.detail.value).toBe('720');
    });

    it('emits playerstack-caption-request (null for Off) on a caption option', () => {
      const { el } = mount();
      el.captions = [{ label: 'English', language: 'en' }];
      el.open_();
      (el.querySelector('[part="mobile-settings-switch"][data-category="captions"]') as HTMLButtonElement).click();

      const received: Array<CustomEvent<{ value: string | null }>> = [];
      document.addEventListener('playerstack-caption-request', (e) =>
        received.push(e as CustomEvent<{ value: string | null }>),
      );
      (el.querySelector('[part="mobile-settings-option"][data-value="en"]') as HTMLButtonElement).click();
      expect(received[0]?.detail.value).toBe('en');

      el.open_();
      (el.querySelector('[part="mobile-settings-switch"][data-category="captions"]') as HTMLButtonElement).click();
      (el.querySelector('[part="mobile-settings-option"][data-value="off"]') as HTMLButtonElement).click();
      expect(received[1]?.detail.value).toBeNull();
    });
  });
});
