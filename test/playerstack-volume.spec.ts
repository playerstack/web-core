import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-volume` — the mute toggle + volume slider UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="mute-button"` + `part="volume"`
 * with slider/track/track-fill/thumb), store→`data-muted` + fill-width propagation (Req 3.3),
 * and request-event wiring: mute/unmute on button click and a volume request on slider click
 * (Req 2.1).
 *
 * The slider click handler reads `track.getBoundingClientRect()`, which returns zeros in jsdom.
 * To exercise the volume request path the track rect is stubbed to `{ left:0, width:100 }` so a
 * click at `clientX=50` maps to a `0.5` volume via the shared `getVolumePercentage` geometry.
 */
registerPlayerstackElements();

/** A DOMRect stub with a real width so the slider geometry computes a non-zero volume. */
const RECT_100: DOMRect = {
  left: 0,
  width: 100,
  top: 0,
  height: 10,
  right: 100,
  bottom: 10,
  x: 0,
  y: 0,
  toJSON() {
    return {};
  },
};

/** Creates a connected controller host and a volume child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-volume');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-volume', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="mute-button" and part="volume" with slider parts', () => {
      const { el } = mount();
      const root = el;

      const button = root.querySelector('[part="mute-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-volume')).not.toBeNull();
      expect(root.querySelector('.icon-muted')).not.toBeNull();
      expect(root.querySelector('[part="volume"]')).not.toBeNull();
      expect(root.querySelector('[part="slider"]')).not.toBeNull();
      expect(root.querySelector('[part="track"]')).not.toBeNull();
      expect(root.querySelector('[part="track-fill"]')).not.toBeNull();
      expect(root.querySelector('[part="thumb"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-muted from the store', () => {
      const { host, el } = mount();

      // Booleans are JSON-encoded onto the host `data-*` attribute; only a `null` reflected
      // value removes it, so a `false` state reflects as the string `"false"`.
      host.store.set({ isMuted: true });
      expect(el.getAttribute('data-muted')).toBe('true');

      host.store.set({ isMuted: false });
      expect(el.getAttribute('data-muted')).toBe('false');
    });

    it('updates the track-fill width from the store volume', () => {
      const { host, el } = mount();
      const fill = (el).querySelector('[part="track-fill"]') as HTMLElement;

      host.store.set({ volume: 0.25 });
      expect(fill.style.width).toBe('25%');

      host.store.set({ volume: 1 });
      expect(fill.style.width).toBe('100%');
    });

    // Regression (volume thumb positioning): the thumb `left` must track the store volume so
    // it rides the end of the fill — previously the thumb was never positioned.
    it('positions the thumb left at the store volume percentage', () => {
      const { host, el } = mount();
      const thumb = (el).querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ volume: 0.25 });
      expect(thumb.style.left).toBe('25%');

      host.store.set({ volume: 1 });
      expect(thumb.style.left).toBe('100%');
    });

    // Muting drains the fill AND drops the thumb to the silence end (0% in the default start
    // origin), then unmuting restores both to the stored volume.
    it('collapses the fill and thumb to 0 when muted, restores on unmute', () => {
      const { host, el } = mount();
      const fill = (el).querySelector('[part="track-fill"]') as HTMLElement;
      const thumb = (el).querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ volume: 0.7, isMuted: false });
      expect(fill.style.width).toBe('70%');
      expect(thumb.style.left).toBe('70%');

      host.store.set({ isMuted: true });
      expect(fill.style.width).toBe('0%');
      expect(thumb.style.left).toBe('0%');

      host.store.set({ isMuted: false });
      expect(fill.style.width).toBe('70%');
      expect(thumb.style.left).toBe('70%');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-mute-request when unmuted', () => {
      const { host, el } = mount();
      host.store.set({ isMuted: false });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-mute-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="mute-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-unmute-request when muted', () => {
      const { host, el } = mount();
      host.store.set({ isMuted: true });

      const received: CustomEvent[] = [];
      document.addEventListener('playerstack-unmute-request', (e) => received.push(e as CustomEvent));

      const button = (el).querySelector('[part="mute-button"]') as HTMLButtonElement;
      button.click();

      expect(received).toHaveLength(1);
    });

    it('emits playerstack-volume-request with the computed volume on pointerdown (press)', () => {
      const { el } = mount();
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const received: Array<CustomEvent<{ volume: number }>> = [];
      document.addEventListener('playerstack-volume-request', (e) =>
        received.push(e as CustomEvent<{ volume: number }>),
      );

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 50, bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.volume).toBeCloseTo(0.5);
      expect(received[0]?.composed).toBe(true);
    });

    // Regression (volume drag): press-and-drag must emit the live volume continuously on move
    // and again on release — previously only a single click seeked and drag did nothing.
    it('emits playerstack-volume-request continuously while dragging and on release', () => {
      const { el } = mount();
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const volumes: number[] = [];
      document.addEventListener('playerstack-volume-request', (e) =>
        volumes.push((e as CustomEvent<{ volume: number }>).detail.volume),
      );

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 20, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, bubbles: true }));

      // press(0.2) + move(0.6) + move(0.9) + release(1.0)
      expect(volumes).toHaveLength(4);
      expect(volumes[0]).toBeCloseTo(0.2);
      expect(volumes[1]).toBeCloseTo(0.6);
      expect(volumes[2]).toBeCloseTo(0.9);
      expect(volumes[3]).toBeCloseTo(1.0);
    });

    // Moving without a preceding press must NOT emit (no drag in progress).
    it('does not emit on pointermove when not dragging', () => {
      const { el } = mount();
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const received: Event[] = [];
      document.addEventListener('playerstack-volume-request', (e) => received.push(e));

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));

      expect(received).toHaveLength(0);
    });
  });

  describe('orientation="vertical" (native vertical drag: bottom = silence, up = louder)', () => {
    // A tall track: 4px wide, 100px tall, spanning y 0..100. `bottom` is 100, `top` is 0.
    const RECT_VERTICAL: DOMRect = {
      left: 0,
      width: 4,
      top: 0,
      height: 100,
      right: 4,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    };

    function mountVertical(): { host: PlayerstackMediaController; el: HTMLElement } {
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      const el = document.createElement('playerstack-volume');
      el.setAttribute('orientation', 'vertical');
      host.appendChild(el);
      return { host, el };
    }

    it('reflects data-orientation="vertical" on the host', () => {
      const { el } = mountVertical();
      expect(el.getAttribute('data-orientation')).toBe('vertical');
    });

    // Regression: flipping `orientation` AT RUNTIME (after connect) must re-lay-out the slider.
    // `orientation` is observed but its effect lives in `updateFill()`, which used to run only on
    // a store change — so a dynamic flip (e.g. a composed `<Volume orientation>` re-render) left
    // `data-orientation` stale until an unrelated state change. `onAttributeChanged` now re-applies
    // it immediately.
    it('re-reflects data-orientation when the orientation attribute changes at runtime', () => {
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      const el = document.createElement('playerstack-volume');
      host.appendChild(el);
      // Mounted horizontal (no orientation attr) → no data-orientation.
      expect(el.getAttribute('data-orientation')).toBeNull();

      // Flip to vertical after connect (no store change in between).
      el.setAttribute('orientation', 'vertical');
      expect(el.getAttribute('data-orientation')).toBe('vertical');

      // Flip back to horizontal → the hook is removed again.
      el.setAttribute('orientation', 'horizontal');
      expect(el.getAttribute('data-orientation')).toBeNull();
    });

    it('maps the pointer Y to volume inverted (clientY near the bottom → low, near the top → high)', () => {
      const { el } = mountVertical();
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_VERTICAL);

      const volumes: number[] = [];
      document.addEventListener('playerstack-volume-request', (e) =>
        volumes.push((e as CustomEvent<{ volume: number }>).detail.volume),
      );

      // clientY 90 → offsetY = bottom(100) - 90 = 10 → 0.1 (near bottom = quiet)
      slider.dispatchEvent(new MouseEvent('pointerdown', { clientY: 90, bubbles: true }));
      // Drag up: clientY 50 → 0.5, clientY 10 → 0.9
      slider.dispatchEvent(new MouseEvent('pointermove', { clientY: 50, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientY: 10, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientY: 0, bubbles: true }));

      expect(volumes).toHaveLength(4);
      expect(volumes[0]).toBeCloseTo(0.1);
      expect(volumes[1]).toBeCloseTo(0.5);
      expect(volumes[2]).toBeCloseTo(0.9);
      expect(volumes[3]).toBeCloseTo(1.0);
    });

    it('paints the fill HEIGHT (not width) and positions the thumb via bottom', () => {
      const { host, el } = mountVertical();
      host.store.set({ volume: 0.75, isMuted: false });

      const trackFill = el.querySelector('[part="track-fill"]') as HTMLElement;
      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;

      expect(trackFill.style.height).toBe('75%');
      expect(trackFill.style.width).toBe('');
      // Thumb `bottom` is the radius-inset calc (clamped so the handle never overflows the ends):
      // radius + pct% - 2·radius·fraction → at 75% => calc(75% - 3.5px).
      expect(thumb.style.bottom).toBe('calc(75% - 3.5px)');
      expect(thumb.style.left).toBe('');
    });

    it('clamps the thumb inside the track at both extremes (0% and 100%)', () => {
      const { host, el } = mountVertical();
      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ volume: 0, isMuted: false });
      // 0% → radius offset keeps the handle centre 7px ABOVE the silence end: calc(0% + 7px).
      expect(thumb.style.bottom).toBe('calc(0% + 7px)');

      host.store.set({ volume: 1, isMuted: false });
      // 100% → centre 7px BELOW the full end: calc(100% - 7px).
      expect(thumb.style.bottom).toBe('calc(100% - 7px)');
    });

    it('shows the percentage tooltip anchored on the Y axis while dragging', () => {
      const { host, el } = mountVertical();
      // The tooltip mirrors the STORE volume (like horizontal): set it, then start a drag.
      host.store.set({ volume: 0.5, isMuted: false });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const tooltip = el.querySelector('[part="volume-tooltip"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_VERTICAL);

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientY: 50, bubbles: true }));

      // Visible + anchored on the Y axis (bottom, matching the store volume) — never on `left`.
      // At 50% the radius offset is 0, so the inset calc collapses to `calc(50% - 0px)`.
      expect(tooltip.getAttribute('data-visible')).toBe('true');
      expect(tooltip.style.bottom).toBe('calc(50% - 0px)');
      expect(tooltip.style.left).toBe('');
    });
  });

  describe('fill-origin="end" (audio: full volume at left, silence at icon side, no mute snap)', () => {
    function mountEnd(): { host: PlayerstackMediaController; el: HTMLElement } {
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      const el = document.createElement('playerstack-volume');
      el.setAttribute('fill-origin', 'end');
      host.appendChild(el);
      return { host, el };
    }

    it('anchors the fill to the right and mirrors the thumb (80% → thumb 20%)', () => {
      const { host, el } = mountEnd();
      const fill = el.querySelector('[part="track-fill"]') as HTMLElement;
      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ volume: 0.8, isMuted: false });
      expect(fill.style.width).toBe('80%');
      // Anchoring is owned by the Style_Layer via the reflected `data-fill-origin` (the element
      // only sets width); the host carries the hook and the thumb is mirrored.
      expect(el.getAttribute('data-fill-origin')).toBe('end');
      expect(thumb.style.left).toBe('20%');
    });

    it('mutes: fill drains AND thumb rests at the right (100%, next to the icon)', () => {
      const { host, el } = mountEnd();
      const fill = el.querySelector('[part="track-fill"]') as HTMLElement;
      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ volume: 0.8, isMuted: false });
      host.store.set({ isMuted: true });
      expect(fill.style.width).toBe('0%');
      expect(thumb.style.left).toBe('100%');
    });

    it('inverts the pointer axis: near the icon (right) = quiet, far (left) = loud', () => {
      const { el } = mountEnd();
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const volumes: number[] = [];
      document.addEventListener('playerstack-volume-request', (e) =>
        volumes.push((e as CustomEvent<{ volume: number }>).detail.volume),
      );

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 20, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 90, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 90, bubbles: true }));

      expect(volumes[0]).toBeCloseTo(0.8); // far from icon = loud
      expect(volumes[2]).toBeCloseTo(0.1); // near icon = quiet
    });
  });

  describe('percentage tooltip (StyledVolumePercentTooltip parity)', () => {
    it('renders a hidden volume-tooltip by default', () => {
      const { el } = mount();
      const tip = (el).querySelector('[part="volume-tooltip"]') as HTMLElement;
      expect(tip).not.toBeNull();
      expect(tip.getAttribute('data-visible')).toBe('false');
    });

    it('shows the percentage on slider hover and hides on leave', () => {
      const { host, el } = mount();
      host.store.set({ volume: 0.5, isMuted: false });
      const slider = (el).querySelector('[part="slider"]') as HTMLElement;
      const tip = (el).querySelector('[part="volume-tooltip"]') as HTMLElement;

      slider.dispatchEvent(new Event('pointerenter'));
      expect(tip.getAttribute('data-visible')).toBe('true');
      expect(tip.textContent).toBe('50%');
      expect(tip.style.left).toBe('50%');

      slider.dispatchEvent(new Event('pointerleave'));
      expect(tip.getAttribute('data-visible')).toBe('false');
    });

    it('shows and follows the percentage while dragging, then stays only if hovered', () => {
      const { el } = mount();
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const tip = root.querySelector('[part="volume-tooltip"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      // Feed the emitted volume back into the store (mirrors the real bridge) so the tooltip
      // reads the live value.
      root.addEventListener('playerstack-volume-request', (e) => {
        (root as unknown as { volume: number }).volume = (e as CustomEvent<{ volume: number }>).detail.volume;
      });

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, bubbles: true }));
      expect(tip.getAttribute('data-visible')).toBe('true');

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, bubbles: true }));
      // Dragging keeps it visible.
      expect(tip.getAttribute('data-visible')).toBe('true');

      // Release while NOT hovering hides it.
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 80, bubbles: true }));
      expect(tip.getAttribute('data-visible')).toBe('false');
    });

    it('reads 0% while muted even with a stored volume', () => {
      const { host, el } = mount();
      host.store.set({ volume: 0.8, isMuted: true });
      const slider = (el).querySelector('[part="slider"]') as HTMLElement;
      const tip = (el).querySelector('[part="volume-tooltip"]') as HTMLElement;

      slider.dispatchEvent(new Event('pointerenter'));
      expect(tip.textContent).toBe('0%');
    });
  });
});
