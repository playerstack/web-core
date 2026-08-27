import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-time-slider` — the progress slider UI_Element (Req 3.3, 5.1, 5.2, 5.3,
 * 17.5). It verifies the Markup_Contract (`part="time-slider"` container with slider/track/
 * track-buffered/track-fill/thumb/tooltip/timelens), store→fill-width propagation from the
 * played/buffered progress (Req 3.3), and request-event wiring: a pointer release on the slider
 * emits `playerstack-seek-request` with the hovered time (Req 2.1).
 *
 * The pointer handler reads `track.getBoundingClientRect()`, which returns zeros in jsdom, so
 * the track rect is stubbed to `{ left:0, width:100 }`; with `duration=100` a release at
 * `clientX=50` maps to `time=50` via the shared `getTimeFromSliderPosition` geometry.
 */
registerPlayerstackElements();

/** A DOMRect stub with a real width so the slider geometry computes a non-zero time. */
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

/** Creates a connected controller host and a time-slider child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-time-slider');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-time-slider', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="time-slider" with slider/track/fills/thumb/tooltip/timelens', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="time-slider"]')).not.toBeNull();
      expect(root.querySelector('[part="slider"]')).not.toBeNull();
      expect(root.querySelector('[part="track"]')).not.toBeNull();
      expect(root.querySelector('[part="track-buffered"]')).not.toBeNull();
      expect(root.querySelector('[part="track-fill"]')).not.toBeNull();
      expect(root.querySelector('[part="thumb"]')).not.toBeNull();
      expect(root.querySelector('[part="tooltip"]')).not.toBeNull();
      expect(root.querySelector('[part="tooltip-time"]')).not.toBeNull();
      expect(root.querySelector('[part="tooltip-chapter"]')).not.toBeNull();
      expect(root.querySelector('[part="timelens"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('updates the played and buffered fill widths from the store progress', () => {
      const { host, el } = mount();
      // Classic buffer mode so the single track-buffered bar shows (fragmented mode uses
      // per-range elements and hides track-buffered).
      el.setAttribute('buffer-mode', 'classic');
      const root = el;
      const fill = root.querySelector('[part="track-fill"]') as HTMLElement;
      const buffered = root.querySelector('[part="track-buffered"]') as HTMLElement;

      host.store.set({ duration: 100, seek: 25, loaded: 50 });

      expect(fill.style.width).toBe('25%');
      expect(buffered.style.width).toBe('50%');
    });

    it('clamps the played fill width to 100% when seek exceeds duration', () => {
      const { host, el } = mount();
      const fill = (el).querySelector('[part="track-fill"]') as HTMLElement;

      host.store.set({ duration: 100, seek: 200 });

      expect(fill.style.width).toBe('100%');
    });

    // Regression (thumb positioning): the thumb `left` must ride the played fraction so it sits
    // at the end of the played fill — previously the thumb was never positioned with playback.
    it('positions the thumb left at the played fraction', () => {
      const { host, el } = mount();
      const thumb = (el).querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ duration: 100, seek: 25 });
      expect(thumb.style.left).toBe('25%');

      host.store.set({ duration: 100, seek: 80 });
      expect(thumb.style.left).toBe('80%');
    });

    it('clamps the thumb left to 100% when seek exceeds duration', () => {
      const { host, el } = mount();
      const thumb = (el).querySelector('[part="thumb"]') as HTMLElement;

      host.store.set({ duration: 100, seek: 200 });
      expect(thumb.style.left).toBe('100%');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-seek-request with the hovered time on pointerup', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });

      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      // jsdom may lack PointerEvent; a MouseEvent with `clientX` dispatched under the
      // `pointerup` type is delivered by event-type string, matching the element's listener.
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(50);
      expect(received[0]?.composed).toBe(true);
    });

    it('ignores pointerup when the track has zero width', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({ ...RECT_100, width: 0 });

      const received: Event[] = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, bubbles: true }));

      expect(received).toHaveLength(0);
    });
  });

  describe('press-and-drag scrubbing (Req 2.1, 3.3)', () => {
    it('updates the optimistic fill/thumb on drag and emits seek only on release', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100, seek: 10 });
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const fill = root.querySelector('[part="track-fill"]') as HTMLElement;
      const thumb = root.querySelector('[part="thumb"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const seeks: number[] = [];
      document.addEventListener('playerstack-seek-request', (e) =>
        seeks.push((e as CustomEvent<{ time: number }>).detail.time),
      );

      // Press at 30 -> optimistic fill/thumb move to 30%, host reflects data-time-sliding, no seek yet.
      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, bubbles: true }));
      expect(el.getAttribute('data-time-sliding')).toBe('true');
      expect(fill.style.width).toBe('30%');
      expect(thumb.style.left).toBe('30%');
      expect(seeks).toHaveLength(0);

      // Move to 70 -> optimistic fill/thumb follow, still no seek emitted.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, bubbles: true }));
      expect(fill.style.width).toBe('70%');
      expect(thumb.style.left).toBe('70%');
      expect(seeks).toHaveLength(0);

      // Release at 70 -> emits the final seek and clears the sliding flag.
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 70, bubbles: true }));
      expect(seeks).toEqual([70]);
      expect(el.hasAttribute('data-time-sliding')).toBe(false);
    });

    it('ignores optimistic drag moves when not pressed (hover only)', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100, seek: 40 });
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const fill = root.querySelector('[part="track-fill"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      // A hover move (no press) must NOT move the played fill off the store position.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, bubbles: true }));
      expect(fill.style.width).toBe('40%');
      expect(el.hasAttribute('data-time-sliding')).toBe(false);
    });
  });

  describe('chapter segments (Req 1.6, 3.3)', () => {
    const chapters = [
      { title: 'Intro', startTime: 0 },
      { title: 'Middle', startTime: 40 },
      { title: 'End', startTime: 80 },
    ];

    it('renders a chapter-segment divider per chapter with width from computeChapterSegments', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;

      const overlay = el.querySelector('[part="chapters"]') as HTMLElement;
      const segments = overlay.querySelectorAll('[part="chapter-segment"]');
      expect(segments).toHaveLength(3);
      // 0-40, 40-80, 80-100 of a 100s duration.
      expect((segments[0] as HTMLElement).style.width).toBe('40%');
      expect((segments[1] as HTMLElement).style.width).toBe('40%');
      expect((segments[2] as HTMLElement).style.width).toBe('20%');
      expect(overlay.style.display).toBe('flex');
      expect((segments[0] as HTMLElement).title).toBe('Intro');
    });

    it('hides the chapters overlay when no markers are provided', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const overlay = el.querySelector('[part="chapters"]') as HTMLElement;
      expect(overlay.style.display).toBe('none');
      expect(overlay.querySelectorAll('[part="chapter-segment"]')).toHaveLength(0);
    });

    it('recomputes segments when the duration changes', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      // No duration yet -> no segments.
      const overlay = el.querySelector('[part="chapters"]') as HTMLElement;
      expect(overlay.querySelectorAll('[part="chapter-segment"]')).toHaveLength(0);

      host.store.set({ duration: 200 });
      const segments = overlay.querySelectorAll('[part="chapter-segment"]');
      expect(segments).toHaveLength(3);
      // 0-40 of 200 = 20%.
      expect((segments[0] as HTMLElement).style.width).toBe('20%');
    });

    it('exposes assigned chapters via the getter', () => {
      const { el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      expect((el as unknown as { chapters: typeof chapters }).chapters).toBe(chapters);
    });

    // Regression (per-segment fills): each chapter block paints its OWN buffered + played fill
    // computed per the original ChapterSegments formulas (100 past the end, a linear share
    // inside, 0 before), and the plain track-fill/buffered must NOT double-paint.
    it('paints each segment its own played + buffered fill and zeroes the plain track fills', () => {
      const { host, el } = mount();
      // Classic mode so per-segment buffered fills are active (fragmented mode uses range divs).
      el.setAttribute('buffer-mode', 'classic');
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      // duration 100, segments 0-40 / 40-80 / 80-100. seek=50 (mid seg 1), loaded=90 (into seg 2).
      host.store.set({ duration: 100, seek: 50, loaded: 90 });

      const blocks = el.querySelectorAll('[part="chapter-segment"]');
      const filled = el.querySelectorAll('[part="chapter-segment-filled"]');
      const buffered = el.querySelectorAll('[part="chapter-segment-buffered"]');
      expect(blocks).toHaveLength(3);

      // Played (seek=50): seg0 fully filled (100), seg1 = (50-40)/40 = 25, seg2 = 0.
      expect((filled[0] as HTMLElement).style.width).toBe('100%');
      expect((filled[1] as HTMLElement).style.width).toBe('25%');
      expect((filled[2] as HTMLElement).style.width).toBe('0%');

      // Buffered (loaded=90): seg0 100, seg1 100, seg2 = (90-80)/20 = 50.
      expect((buffered[0] as HTMLElement).style.width).toBe('100%');
      expect((buffered[1] as HTMLElement).style.width).toBe('100%');
      expect((buffered[2] as HTMLElement).style.width).toBe('50%');

      // Plain track fills must be zeroed so only the segments show progress.
      const plainFill = el.querySelector('[part="track-fill"]') as HTMLElement;
      const plainBuffered = el.querySelector('[part="track-buffered"]') as HTMLElement;
      expect(plainFill.style.width).toBe('0%');
      expect(plainBuffered.style.width).toBe('0%');
    });

    // Regression (hovered segment marker): a pointermove marks the segment under the pointer
    // with `data-hovered` (so the Style_Layer scales it), and a pointerleave clears it.
    it('marks the hovered segment on pointermove and clears it on pointerleave', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      const blocks = el.querySelectorAll('[part="chapter-segment"]');

      // Hover at clientX=50 -> time 50 -> segment index 1 (40-80) is hovered.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect((blocks[1] as HTMLElement).hasAttribute('data-hovered')).toBe(true);
      expect((blocks[0] as HTMLElement).hasAttribute('data-hovered')).toBe(false);

      // Move to clientX=10 -> time 10 -> segment index 0; the previous marker moves.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, bubbles: true }));
      expect((blocks[0] as HTMLElement).hasAttribute('data-hovered')).toBe(true);
      expect((blocks[1] as HTMLElement).hasAttribute('data-hovered')).toBe(false);

      // Leaving the slider clears any hovered marker.
      slider.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
      expect((blocks[0] as HTMLElement).hasAttribute('data-hovered')).toBe(false);
    });

    // Regression (tooltip chapter label): when chapters exist, hovering surfaces the hovered
    // chapter's TITLE in the tooltip (StyledChapterLabel) alongside the time.
    it('shows the hovered chapter title in the tooltip at the hovered time', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      const chapterLabel = el.querySelector('[part="tooltip-chapter"]') as HTMLElement;
      const timeLine = el.querySelector('[part="tooltip-time"]') as HTMLElement;

      // Hover at 50s -> Middle chapter (40-80), time 00:50.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect(chapterLabel.textContent).toBe('Middle');
      expect(chapterLabel.style.display).toBe('block');
      expect(timeLine.textContent).toBe('00:50');

      // Hover at 10s -> Intro chapter (0-40).
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, bubbles: true }));
      expect(chapterLabel.textContent).toBe('Intro');
    });

    it('hides the tooltip chapter label when there are no chapters', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      const chapterLabel = el.querySelector('[part="tooltip-chapter"]') as HTMLElement;

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect(chapterLabel.style.display).toBe('none');
      expect(chapterLabel.textContent).toBe('');
    });
  });

  describe('ad mode (parity: slider becomes the yellow ad progress bar)', () => {
    const chapters = [
      { title: 'Intro', startTime: 0 },
      { title: 'Middle', startTime: 40 },
      { title: 'End', startTime: 80 },
    ];

    // Regression: in ad mode the chapter segments must NOT render (the ORIGINAL rendered the plain
    // `adMode` track and no ChapterSegments during an ad), the handle is hidden and the cursor is
    // default, while the plain track-fill still carries the (yellow, via CSS) ad progress.
    it('hides chapter segments and the handle, sets default cursor, and keeps the plain fill', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      host.store.set({ duration: 100, seek: 50, loaded: 60 });

      // Sanity: chapters render before ad mode.
      const overlay = el.querySelector('[part="chapters"]') as HTMLElement;
      expect(overlay.querySelectorAll('[part="chapter-segment"]')).toHaveLength(3);

      (el as unknown as { adMode: boolean }).adMode = true;

      // Chapters gone / overlay hidden; markers ignored.
      expect(overlay.querySelectorAll('[part="chapter-segment"]')).toHaveLength(0);
      expect(overlay.style.display).toBe('none');
      expect(el.hasAttribute('data-has-chapters')).toBe(false);

      // Handle hidden + default cursor.
      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      expect(thumb.style.display).toBe('none');
      expect(slider.style.cursor).toBe('default');

      // The plain track-fill (tinted yellow by the controller `[data-ad-active]` CSS) carries the
      // ad progress: 50/100 = 50%.
      const fill = el.querySelector('[part="track-fill"]') as HTMLElement;
      expect(fill.style.width).toBe('50%');
    });

    // Regression: leaving ad mode restores chapters + handle + the normal (red, via CSS) fill.
    it('restores chapters, handle and cursor when ad mode ends', () => {
      const { host, el } = mount();
      (el as unknown as { chapters: typeof chapters }).chapters = chapters;
      host.store.set({ duration: 100, seek: 50 });
      (el as unknown as { adMode: boolean }).adMode = true;
      (el as unknown as { adMode: boolean }).adMode = false;

      const overlay = el.querySelector('[part="chapters"]') as HTMLElement;
      expect(overlay.querySelectorAll('[part="chapter-segment"]')).toHaveLength(3);
      expect(overlay.style.display).toBe('flex');

      const thumb = el.querySelector('[part="thumb"]') as HTMLElement;
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      expect(thumb.style.display).toBe('');
      expect(slider.style.cursor).toBe('');
    });

    it('exposes the adMode flag via the getter', () => {
      const { el } = mount();
      expect((el as unknown as { adMode: boolean }).adMode).toBe(false);
      (el as unknown as { adMode: boolean }).adMode = true;
      expect((el as unknown as { adMode: boolean }).adMode).toBe(true);
    });

    // Regression: seeking/scrubbing is DISABLED in ad mode — the ad position cannot be changed
    // via the timeline (parity with the original `adMode` slider). Neither a click nor a drag
    // emits `playerstack-seek-request`.
    it('does NOT emit a seek on click or drag while in ad mode', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      (el as unknown as { adMode: boolean }).adMode = true;

      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const seeks: Event[] = [];
      document.addEventListener('playerstack-seek-request', (e) => seeks.push(e));

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 70, bubbles: true }));

      expect(seeks).toHaveLength(0);
      // No drag was started, so no sliding flag either.
      expect(el.hasAttribute('data-time-sliding')).toBe(false);
    });
  });

  describe('hover affordances (tooltip + timelens)', () => {
    it('positions and shows the time tooltip on pointermove', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const tooltip = root.querySelector('[part="tooltip"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));

      expect(tooltip.style.display).toBe('block');
      expect(tooltip.style.left).toBe('50px');
      // 50s of a 100s duration formatted by the shared formatTime helper.
      expect(tooltip.textContent).toBe('00:50');
    });

    it('ignores pointermove when the track has zero width', () => {
      const { el } = mount();
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const tooltip = root.querySelector('[part="tooltip"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({ ...RECT_100, width: 0 });

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));

      // Tooltip stays hidden (initial display is '' before any positioning).
      expect(tooltip.style.display).not.toBe('block');
    });

    it('hides the tooltip and timelens on pointerleave', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const root = el;
      const slider = root.querySelector('[part="slider"]') as HTMLElement;
      const track = root.querySelector('[part="track"]') as HTMLElement;
      const tooltip = root.querySelector('[part="tooltip"]') as HTMLElement;
      const timelens = root.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));

      expect(tooltip.style.display).toBe('none');
      expect(timelens.style.display).toBe('none');
    });
  });

  describe('live-DVR tooltip (negative live offset)', () => {
    it('shows the NEGATIVE live offset on hover when live (parity with the original TimeTooltip)', () => {
      const { host, el } = mount();
      (el as unknown as { live: boolean }).live = true;
      // Store feeds the DVR WINDOW: position as `seek`, window length as `duration`.
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const tooltipTime = el.querySelector('[part="tooltip-time"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      // Hover at clientX=40 -> time 40 in a 100s window -> 40 - 100 = -60s behind live -> "-1:00".
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, bubbles: true }));
      expect(tooltipTime.textContent).toBe('-1:00');
    });

    it('shows 0:00 within 1s of the live edge (offset >= -1)', () => {
      const { host, el } = mount();
      (el as unknown as { live: boolean }).live = true;
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const tooltipTime = el.querySelector('[part="tooltip-time"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      // Hover at the far right (clientX=100 -> time 100 -> offset 0) -> at edge -> formatTime(0).
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, bubbles: true }));
      expect(tooltipTime.textContent).toBe('00:00');
    });

    it('shows the absolute time (not an offset) when NOT live', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const tooltipTime = el.querySelector('[part="tooltip-time"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, bubbles: true }));
      expect(tooltipTime.textContent).toBe('00:40');
    });
  });

  describe('heatmap (most-replayed graph) inside the slider', () => {
    const HEATMAP = [
      { startTime: 0, endTime: 25, value: 0.2 },
      { startTime: 25, endTime: 50, value: 0.9 },
      { startTime: 50, endTime: 100, value: 0.4 },
    ];

    it('renders the heatmap markup inside the time-slider container', () => {
      const { el } = mount();
      const container = el.querySelector('[part="time-slider"]') as HTMLElement;
      expect(container.querySelector('[part="heatmap"]')).not.toBeNull();
      expect(container.querySelector('[part="heatmap-svg"]')).not.toBeNull();
      expect(container.querySelector('[part="heatmap-path"]')).not.toBeNull();
      expect(container.querySelector('[part="heatmap-path-played"]')).not.toBeNull();
    });

    it('computes the curve and sets data-active once data and duration are present', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: typeof HEATMAP }).heatmapData = HEATMAP;
      host.store.set({ duration: 100 });

      const heatmap = el.querySelector('[part="heatmap"]') as HTMLElement;
      const base = el.querySelector('[part="heatmap-path"]') as SVGPathElement;
      const played = el.querySelector('[part="heatmap-path-played"]') as SVGPathElement;
      expect((base.getAttribute('d') ?? '').length).toBeGreaterThan(0);
      expect(played.getAttribute('d')).toBe(base.getAttribute('d'));
      expect(heatmap.getAttribute('data-active')).toBe('true');
      expect(played.getAttribute('clip-path') ?? '').toMatch(/^url\(#playerstack-timeslider-heatmap-\d+\)$/);
    });

    it('sizes the played clip rect from the store seek (clamped 0-100)', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: typeof HEATMAP }).heatmapData = HEATMAP;
      const rect = el.querySelector('clipPath rect') as SVGRectElement;

      host.store.set({ duration: 100, seek: 0 });
      expect(rect.getAttribute('width')).toBe('0');
      host.store.set({ duration: 100, seek: 40 });
      expect(rect.getAttribute('width')).toBe('40');
      host.store.set({ duration: 100, seek: 250 });
      expect(rect.getAttribute('width')).toBe('100');
    });

    it('clears data-active and the path when heatmap data is removed', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: typeof HEATMAP | null }).heatmapData = HEATMAP;
      host.store.set({ duration: 100 });
      (el as unknown as { heatmapData: typeof HEATMAP | null }).heatmapData = null;

      const heatmap = el.querySelector('[part="heatmap"]') as HTMLElement;
      const base = el.querySelector('[part="heatmap-path"]') as SVGPathElement;
      expect(base.getAttribute('d')).toBe('');
      expect(heatmap.hasAttribute('data-active')).toBe(false);
    });

    it('exposes assigned heatmap data via the getter', () => {
      const { el } = mount();
      (el as unknown as { heatmapData: typeof HEATMAP }).heatmapData = HEATMAP;
      expect((el as unknown as { heatmapData: typeof HEATMAP }).heatmapData).toEqual(HEATMAP);
    });
  });

  describe('scrubbing-request wiring (mobile full-area preview drive)', () => {
    it('emits playerstack-scrubbing-request seeking=true on press and on each drag move, false on release', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const events: Array<{ seeking: boolean; time: number }> = [];
      document.addEventListener('playerstack-scrubbing-request', (e) =>
        events.push((e as CustomEvent<{ seeking: boolean; time: number }>).detail),
      );

      // Press at 30 -> scrub start at time 30.
      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, bubbles: true }));
      // Move to 70 -> scrub update at time 70.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, bubbles: true }));
      // Release at 70 -> scrub end.
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 70, bubbles: true }));

      expect(events).toEqual([
        { seeking: true, time: 30 },
        { seeking: true, time: 70 },
        { seeking: false, time: 70 },
      ]);
    });

    it('does NOT emit scrubbing on a hover move without a press', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const events: Event[] = [];
      document.addEventListener('playerstack-scrubbing-request', (e) => events.push(e));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect(events).toHaveLength(0);
    });

    it('does NOT emit scrubbing in ad mode', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      (el as unknown as { adMode: boolean }).adMode = true;
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const events: Event[] = [];
      document.addEventListener('playerstack-scrubbing-request', (e) => events.push(e));
      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 30, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, bubbles: true }));
      slider.dispatchEvent(new MouseEvent('pointerup', { clientX: 70, bubbles: true }));
      expect(events).toHaveLength(0);
    });
  });

  describe('timelens (spriteData direct channel) wiring (Req 1.6)', () => {
    // Two cues so a hovered time can match one and MISS the other (to exercise the "no frame"
    // branch without relying on container size — the timelens now renders NATIVE 1:1).
    const spriteData = {
      cues: [
        { from: 0, to: 40, x: 0, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
        { from: 40, to: 90, x: 160, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
      ],
      sheetSizes: { 'sprite.jpg': { w: 1600, h: 900 } },
    };

    it('exposes assigned spriteData via the getter', () => {
      const { el } = mount();
      (el as unknown as { spriteData: typeof spriteData }).spriteData = spriteData;
      expect((el as unknown as { spriteData: typeof spriteData }).spriteData).toBe(spriteData);
    });

    it('hides the timelens immediately when spriteData is cleared to null', () => {
      const { el } = mount();
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      (el as unknown as { spriteData: typeof spriteData | null }).spriteData = spriteData;
      (el as unknown as { spriteData: typeof spriteData | null }).spriteData = null;
      expect(timelens.style.display).toBe('none');
      expect(timelens.hasAttribute('data-visible')).toBe(false);
    });

    it('renders the timelens frame at NATIVE size (1:1, no scale) on pointermove', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      (el as unknown as { spriteData: typeof spriteData }).spriteData = spriteData;

      // Hover at clientX=50 -> time 50 -> matches the SECOND cue (x=160). NATIVE render: box sized
      // to the cue's own w/h, sheet offset by -x/-y, no background-size, faded in via data-visible.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));

      expect(timelens.style.display).toBe('block');
      expect(timelens.getAttribute('data-visible')).toBe('true');
      expect(timelens.style.width).toBe('160px');
      expect(timelens.style.height).toBe('90px');
      expect(timelens.style.backgroundImage).toContain('sprite.jpg');
      expect(timelens.style.backgroundPosition).toBe('-160px 0px');
      // No cover-scale sizing on the native timelens.
      expect(timelens.style.backgroundSize).toBe('');
    });

    it('clamps the timelens left so it never overflows the slider track', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      (el as unknown as { spriteData: typeof spriteData }).spriteData = spriteData;

      // Pointer near the left edge: centered left would be negative, so it clamps to 0.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, bubbles: true }));
      expect(timelens.style.left).toBe('0px');

      // Pointer near the right edge: centered left would overflow, so it clamps to width - w.
      // rect width 100, frame w 160 -> max(0, 100-160) = 0.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 98, bubbles: true }));
      expect(timelens.style.left).toBe('0px');
    });

    it('hides the timelens when no cue matches the hovered time', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);
      (el as unknown as { spriteData: typeof spriteData }).spriteData = spriteData;

      // Hover at clientX=95 -> time 95, which is past the last cue's `to` (90) -> no frame.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 95, bubbles: true }));

      expect(timelens.style.display).toBe('none');
      expect(timelens.hasAttribute('data-visible')).toBe(false);
    });
  });

  describe('timelens (adapter + sprite-vtt-file) self-resolution (Req 1.6)', () => {
    // A minimal VTT with a relative sheet path so the element's base-URL resolution is exercised.
    const VTT = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:40.000',
      'storyboard.jpg#xywh=0,0,160,90',
      '',
      '00:00:40.000 --> 00:00:90.000',
      'storyboard.jpg#xywh=160,0,160,90',
      '',
    ].join('\n');

    /** A SpriteAdapter stub that returns the VTT text and never touches the network. */
    function stubAdapter(vtt: string) {
      return {
        fetchVtt: jest.fn().mockResolvedValue(vtt),
        loadSheetSizes: jest.fn().mockResolvedValue({}),
        getContainerSize: jest.fn().mockReturnValue({ width: 0, height: 0 }),
      };
    }

    it('fetches + parses the VTT via the adapter and renders a native frame on hover', async () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const adapter = stubAdapter(VTT);
      (el as unknown as { adapter: typeof adapter }).adapter = adapter;
      el.setAttribute('sprite-vtt-file', 'https://cdn.example.com/thumbs/index.vtt');
      // Let the async fetch/parse settle.
      await Promise.resolve();
      await Promise.resolve();

      expect(adapter.fetchVtt).toHaveBeenCalledWith('https://cdn.example.com/thumbs/index.vtt');

      // Hover at time 50 -> second cue (x=160). Relative sheet path resolved to the VTT base URL.
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect(timelens.style.display).toBe('block');
      expect(timelens.style.width).toBe('160px');
      expect(timelens.style.backgroundImage).toContain('https://cdn.example.com/thumbs/storyboard.jpg');
      expect(timelens.style.backgroundPosition).toBe('-160px 0px');
    });

    it('leaves the timelens hidden when the VTT fetch rejects', async () => {
      const { host, el } = mount();
      host.store.set({ duration: 100 });
      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      const timelens = el.querySelector('[part="timelens"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const adapter = {
        fetchVtt: jest.fn().mockRejectedValue(new Error('network')),
        loadSheetSizes: jest.fn().mockResolvedValue({}),
        getContainerSize: jest.fn().mockReturnValue({ width: 0, height: 0 }),
      };
      (el as unknown as { adapter: typeof adapter }).adapter = adapter;
      el.setAttribute('sprite-vtt-file', 'https://cdn.example.com/thumbs/index.vtt');
      await Promise.resolve();
      await Promise.resolve();

      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
      expect(timelens.style.display).toBe('none');
    });
  });
});
