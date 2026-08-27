import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { LiveDVRState } from '@typings/live-dvr.types';

/**
 * Spec for `playerstack-live-indicator` — the LIVE status badge UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="live-indicator"` with `live-dot`
 * and `live-label`), state propagation from the `dvrState` setter (`data-live`/`data-at-edge`),
 * and request-event wiring: clicking while behind live emits a `playerstack-seek-request`
 * targeting `seekableEnd`; clicking at the edge is a no-op (Req 2.1). The negative live offset
 * is NOT rendered here (parity with the monolith — it lives in `playerstack-play-time`).
 */
registerPlayerstackElements();

/** A full `LiveDVRState` behind the live edge (80s behind, seekable window to 200s). */
const BEHIND_LIVE: LiveDVRState = {
  hasDVR: true,
  seekableStart: 0,
  seekableEnd: 200,
  seekableWindow: 200,
  isAtLiveEdge: false,
  liveEdgeOffset: -80,
  sliderDuration: 200,
  sliderPosition: 120,
};

/** Creates a connected controller host and a live-indicator child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-live-indicator');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-live-indicator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="live-indicator" with a dot and a "Live" label, and NO offset region', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="live-indicator"]')).not.toBeNull();
      expect(root.querySelector('[part="live-dot"]')).not.toBeNull();
      expect(root.querySelector('[part="live-label"]')?.textContent).toBe('Live');
      // The negative offset is shown by playerstack-play-time, not the badge (parity, no dup).
      expect(root.querySelector('[part="live-offset"]')).toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      (el as unknown as { dvrState: LiveDVRState }).dvrState = BEHIND_LIVE;
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('state propagation (Req 3.3)', () => {
    it('reflects data-live and data-at-edge false when behind the live edge (no offset text)', () => {
      const { el } = mount();
      (el as unknown as { dvrState: LiveDVRState }).dvrState = BEHIND_LIVE;

      expect(el.getAttribute('data-live')).toBe('true');
      expect(el.getAttribute('data-at-edge')).toBe('false');
      // Offset is not rendered by the badge anymore (lives in playerstack-play-time).
      expect((el).querySelector('[part="live-offset"]')).toBeNull();
    });

    // Pure live (no DVR window / no dvrState): the viewer is always at the edge, so the badge must
    // show the RED at-edge dot even without any dvrState. Regression for the "grey dot on first
    // load of a pure live stream" bug.
    it('reflects data-live and data-at-edge true in pure-live mode (no dvrState)', () => {
      const { el } = mount();
      (el as unknown as { pureLive: boolean }).pureLive = true;

      expect(el.getAttribute('data-live')).toBe('true');
      expect(el.getAttribute('data-at-edge')).toBe('true');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('dispatches a seek request targeting seekableEnd when clicked behind live', () => {
      const { el } = mount();
      (el as unknown as { dvrState: LiveDVRState }).dvrState = BEHIND_LIVE;

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      (el).querySelector<HTMLElement>('[part="live-indicator"]')?.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(200);
    });

    it('is a no-op when already at the live edge', () => {
      const { el } = mount();
      (el as unknown as { dvrState: LiveDVRState }).dvrState = { ...BEHIND_LIVE, isAtLiveEdge: true };

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent));

      (el).querySelector<HTMLElement>('[part="live-indicator"]')?.click();

      expect(received).toHaveLength(0);
    });
  });
});
