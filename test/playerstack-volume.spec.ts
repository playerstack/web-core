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
