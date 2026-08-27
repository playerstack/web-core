import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import { getTranslations } from '@i18n/index';

/**
 * Spec for `playerstack-prevented-tip` — the blocked-playback tip UI_Element (Req 1.4, 3.3, 5.1,
 * 5.3). Ports the original `PreventedTip` behavior: it surfaces the STUCK tip (play glyph +
 * "stuck" message) when `hasResource && prevented && currentTime===0 && paused`, and the
 * CLICK-TO-UNMUTE tip (muted glyph + "click to unmute" message + a full-stage click-catcher) when
 * `hasResource && prevented && !paused && muted && !preventedClicked`. A click emits
 * `playerstack-prevented-click` and marks the unmute tip dismissed.
 */
registerPlayerstackElements();

interface TipInputs {
  hasResource: boolean;
  prevented: boolean;
  paused: boolean;
  muted: boolean;
  currentTime: number;
}

/** Creates a connected controller host and a prevented-tip child wired to its store. */
function mount(language?: string): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-prevented-tip');
  if (language !== undefined) {
    el.setAttribute('language', language);
  }
  host.appendChild(el);
  return { host, el };
}

/** Sets the visibility inputs on the element via the property channel. */
function setInputs(el: HTMLElement, inputs: TipInputs): void {
  const tip = el as unknown as TipInputs;
  tip.hasResource = inputs.hasResource;
  tip.prevented = inputs.prevented;
  tip.paused = inputs.paused;
  tip.muted = inputs.muted;
  tip.currentTime = inputs.currentTime;
}

describe('playerstack-prevented-tip', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.3)', () => {
    it('renders the pill (icon + message), and the full-stage click-catcher', () => {
      const { el } = mount('en');
      expect(el.querySelector('[part="prevented-tip"]')).not.toBeNull();
      expect(el.querySelector('[part="prevented-tip-icon"]')).not.toBeNull();
      expect(el.querySelector('[part="prevented-tip-message"]')).not.toBeNull();
      expect(el.querySelector('[part="prevented-tip-clicked"]')).not.toBeNull();
    });

    it('matches the rendered markup snapshot', () => {
      const { el } = mount('en');
      expect(el.innerHTML).toMatchSnapshot();
    });
  });

  describe('stuck tip (playback blocked at start)', () => {
    it('shows the stuck message + play glyph when hasResource && prevented && currentTime===0 && paused', () => {
      const { el } = mount('en');
      setInputs(el, { hasResource: true, prevented: true, paused: true, muted: false, currentTime: 0 });

      expect(el.getAttribute('data-mode')).toBe('stuck');
      expect(el.getAttribute('data-active')).toBe('true');
      const message = el.querySelector('[part="prevented-tip-message"]');
      expect(message?.textContent).toBe(getTranslations('en').playbackStuckClickResumePlayback);
      const icon = el.querySelector('[part="prevented-tip-icon"]');
      expect(icon?.querySelector('svg')).not.toBeNull();
      // The stuck tip has NO full-stage click-catcher.
      const catcher = el.querySelector('[part="prevented-tip-clicked"]') as HTMLElement;
      expect(catcher.style.display).toBe('none');
    });

    it('stays hidden without a resource or when not prevented', () => {
      const { el } = mount('en');
      setInputs(el, { hasResource: false, prevented: true, paused: true, muted: false, currentTime: 0 });
      expect(el.getAttribute('data-mode')).toBe('none');
      expect(el.getAttribute('data-active')).toBe('false');

      setInputs(el, { hasResource: true, prevented: false, paused: true, muted: false, currentTime: 0 });
      expect(el.getAttribute('data-mode')).toBe('none');
    });
  });

  describe('click-to-unmute tip (muted autoplay)', () => {
    it('shows the unmute message + muted glyph + click-catcher when playing muted', () => {
      const { el } = mount('en');
      setInputs(el, { hasResource: true, prevented: true, paused: false, muted: true, currentTime: 5 });

      expect(el.getAttribute('data-mode')).toBe('unmute');
      expect(el.getAttribute('data-active')).toBe('true');
      const message = el.querySelector('[part="prevented-tip-message"]');
      expect(message?.textContent).toBe(getTranslations('en').clickToUnmute);
      const catcher = el.querySelector('[part="prevented-tip-clicked"]') as HTMLElement;
      expect(catcher.style.display).toBe('block');
    });

    it('emits playerstack-prevented-click on click and never re-shows the unmute tip', () => {
      const { el } = mount('en');
      setInputs(el, { hasResource: true, prevented: true, paused: false, muted: true, currentTime: 5 });

      const received: Event[] = [];
      document.addEventListener('playerstack-prevented-click', (e) => received.push(e));

      const catcher = el.querySelector('[part="prevented-tip-clicked"]') as HTMLElement;
      catcher.click();

      expect(received).toHaveLength(1);
      // Marked clicked → the unmute tip must not re-show even with the same inputs.
      expect(el.getAttribute('data-mode')).toBe('none');
      expect(catcher.style.display).toBe('none');
    });

    it('does not show the unmute tip when not muted', () => {
      const { el } = mount('en');
      setInputs(el, { hasResource: true, prevented: true, paused: false, muted: false, currentTime: 5 });
      expect(el.getAttribute('data-mode')).toBe('none');
    });
  });

  describe('i18n', () => {
    it('resolves the tip text in the configured language', () => {
      const { el } = mount('es');
      setInputs(el, { hasResource: true, prevented: true, paused: true, muted: false, currentTime: 0 });
      const message = el.querySelector('[part="prevented-tip-message"]');
      expect(message?.textContent).toBe(getTranslations('es').playbackStuckClickResumePlayback);
    });
  });
});
