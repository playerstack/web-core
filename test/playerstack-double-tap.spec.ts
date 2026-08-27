import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-double-tap` — the double-tap-to-skip overlay UI_Element that owns a
 * headless `DoubleTapController` (Req 3.3, 5.1, 5.2, 5.3, 17.5). It verifies the Markup_Contract
 * (`part="double-tap"` with left/right zones and a `skip-indicator`), and request-event
 * wiring: two quick taps on the right zone trigger a `playerstack-seek-request` at
 * `seek + skipSeconds` (default 10 → 60) and surface the skip indicator (Req 2.1, 3.3).
 *
 * Fake timers isolate the controller's single-tap delay timer; the second tap lands before the
 * delay elapses, so the controller skips synchronously on the second `handleTapRight`.
 */
registerPlayerstackElements();

/** Creates a connected controller host and a double-tap child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-double-tap');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-double-tap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="double-tap" with left/right zones and a skip-indicator', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="double-tap"]')).not.toBeNull();
      expect(root.querySelector('[part="double-tap-left"]')).not.toBeNull();
      expect(root.querySelector('[part="double-tap-right"]')).not.toBeNull();
      expect(root.querySelector('[part="skip-indicator"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('request-event wiring (Req 2.1, 3.3)', () => {
    it('emits a seek request at seek + skipSeconds and shows the skip indicator on double-tap right', () => {
      const { host, el } = mount();
      host.store.set({ seek: 50, duration: 100 });

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      const right = (el).querySelector('[part="double-tap-right"]') as HTMLElement;
      right.click();
      right.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(60);
      expect(el.getAttribute('data-active')).toBe('true');
      // `reflectStateToAttributes` JSON-encodes values, so the string direction is quoted.
      expect(el.getAttribute('data-direction')).toBe('"forward"');
      // The indicator now shows the accumulated seconds + the localized "seconds" label in a
      // dedicated text region (parity with the original SkipOverlay `{seconds} {i18n.seconds}`),
      // alongside the chevron glyphs.
      const indicatorText = (el).querySelector('[part="skip-indicator-text"]');
      expect(indicatorText?.textContent).toBe('10 seconds');
    });

    it('skips backward on double-tap left, emitting a seek at seek - skipSeconds', () => {
      const { host, el } = mount();
      host.store.set({ seek: 50, duration: 100 });

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      const left = (el).querySelector('[part="double-tap-left"]') as HTMLElement;
      left.click();
      left.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(40);
      expect(el.getAttribute('data-direction')).toBe('"backward"');
    });
  });

  describe('single tap (Req 1.6)', () => {
    it('emits singleTap (no skip) when a tap is not followed by a second within the delay', () => {
      const { host, el } = mount();
      host.store.set({ seek: 50, duration: 100 });

      const received: Event[] = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e));

      const right = (el).querySelector('[part="double-tap-right"]') as HTMLElement;
      right.click();
      // Let the double-tap window elapse so the controller resolves it as a single tap
      // (which the element observes as a no-op, not a skip).
      jest.advanceTimersByTime(500);

      expect(received).toHaveLength(0);
      // A single tap never accumulates a skip, so no active state is reflected.
      expect(el.getAttribute('data-active')).toBeNull();
    });
  });

  describe('config setter (Req 1.6)', () => {
    it('recreates the controller with a custom skipSeconds and re-wires the seek request', () => {
      const { host, el } = mount();
      (el as unknown as { config: { skipSeconds: number } }).config = { skipSeconds: 5 };
      host.store.set({ seek: 50, duration: 100 });

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      const right = (el).querySelector('[part="double-tap-right"]') as HTMLElement;
      right.click();
      right.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(55);
    });

    it('accepts a null config, resetting to controller defaults', () => {
      const { host, el } = mount();
      (el as unknown as { config: { skipSeconds: number } | null }).config = null;
      host.store.set({ seek: 50, duration: 100 });

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      const right = (el).querySelector('[part="double-tap-right"]') as HTMLElement;
      right.click();
      right.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(60);
    });
  });
});
