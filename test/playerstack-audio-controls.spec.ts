import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { PlayerstackAudioControls } from '@ui/elements/playerstack-audio-controls';
import { registerPlayerstackElements } from '@ui/register';
import { formatTime } from '@utils/format';

/**
 * Spec for `playerstack-audio-controls` — the compact single-row audio control bar UI_Element
 * (Req 2.1, 3.3, 5.1, 5.2, 5.3). It reproduces the original audio skin's `StyledControlsRow`, so
 * this spec verifies the Markup_Contract (transport buttons, content-area label↔timeline,
 * remaining-time read-out, chapter/single timeline), store→data-* propagation (`data-playing`,
 * `data-ended`, `data-buffering`, remaining-time text, chapter segments), and request-event
 * wiring: the play button emits play/pause (skip-ad in ad mode); the skip ±10s buttons and the
 * timeline emit seek requests (Req 2.1).
 *
 * The seek handler reads `track.getBoundingClientRect()`, which returns zeros in jsdom, so the
 * track rect is stubbed to `{ left:0, width:100 }`; with `duration=100` a pointerdown at
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

/** Creates a connected controller host and an audio-controls child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: PlayerstackAudioControls } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-audio-controls') as PlayerstackAudioControls;
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-audio-controls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders the transport + content-area + timeline + remaining-time parts', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="audio-controls"]')).not.toBeNull();
      expect(root.querySelector('[part="skip-back-button"]')).not.toBeNull();
      expect(root.querySelector('[part="play-button"]')).not.toBeNull();
      expect(root.querySelector('[part="skip-forward-button"]')).not.toBeNull();
      expect(root.querySelector('[part="content-area"]')).not.toBeNull();
      expect(root.querySelector('[part="media-label"]')).not.toBeNull();
      expect(root.querySelector('[part="timeline-wrapper"]')).not.toBeNull();
      expect(root.querySelector('[part="slider"]')).not.toBeNull();
      expect(root.querySelector('[part="track"]')).not.toBeNull();
      expect(root.querySelector('[part="time"]')).not.toBeNull();
    });

    it('matches the rendered markup snapshot', () => {
      const { el } = mount();
      expect(el.innerHTML).toMatchSnapshot();
    });
  });

  describe('store→data-* propagation (Req 3.3)', () => {
    it('reflects data-playing and shows the REMAINING time (-M:SS) plus a single-track fill', () => {
      const { host, el } = mount();
      const root = el;

      host.store.set({ playing: true, seek: 25, duration: 100 });

      expect(el.getAttribute('data-playing')).toBe('true');
      // Remaining time = duration - seek = 75s, formatted as `-M:SS`.
      expect(root.querySelector('[part="time"]')?.textContent).toBe(`-${formatTime(75)}`);
      const fill = root.querySelector('[part="track-fill"]') as HTMLElement;
      expect(fill.style.width).toBe('25%');
    });

    it('reflects data-ended and shows the "Replay:" label prefix when ended', () => {
      const { host, el } = mount();
      el.title = 'Sprite Fight';

      host.store.set({ playing: false, isEnded: true, seek: 100, duration: 100 });

      expect(el.getAttribute('data-ended')).toBe('true');
      const label = el.querySelector('[part="media-label"]') as HTMLElement;
      expect(label.textContent).toContain('Replay: ');
      expect(label.textContent).toContain('Sprite Fight');
    });

    it('reflects data-buffering and renders loading stripes over the unbuffered portion', () => {
      const { host, el } = mount();

      host.store.set({ duration: 100, seek: 10, isBuffering: true, bufferedRanges: [{ start: 0, end: 30 }] });

      expect(el.getAttribute('data-buffering')).toBe('true');
      expect(el.querySelector('[part="loading-stripes"]')).not.toBeNull();
    });

    it('renders per-chapter segments when chapters are supplied', () => {
      const { host, el } = mount();
      el.chapters = [
        { title: 'Intro', startTime: 0 },
        { title: 'Middle', startTime: 50 },
      ];
      host.store.set({ duration: 100, seek: 10 });

      expect(el.querySelectorAll('[part="chapter-segment"]').length).toBe(2);
    });
  });

  describe('chapter hover (parity with original hoveredSegmentIndex)', () => {
    /** A DOMRect stub so pointer geometry computes a hovered time in jsdom. */
    const RECT: DOMRect = {
      left: 0,
      width: 100,
      top: 0,
      height: 6,
      right: 100,
      bottom: 6,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    };

    it('pops the segment UNDER THE POINTER (not the playing one) and shows its title in the tooltip', () => {
      const { host, el } = mount();
      el.chapters = [
        { title: 'Intro', startTime: 0 },
        { title: 'Middle', startTime: 50 },
      ];
      // Playhead is in the FIRST chapter (seek 10 / duration 100).
      host.store.set({ duration: 100, seek: 10, playing: true });

      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT);

      // Hover over the SECOND chapter (x=70 → time 70).
      slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, bubbles: true }));

      const segments = el.querySelectorAll('[part="chapter-segment"]');
      // The hovered (second) segment pops, NOT the playing (first) one.
      expect(segments[0]?.hasAttribute('data-hovered')).toBe(false);
      expect(segments[1]?.hasAttribute('data-hovered')).toBe(true);

      // Tooltip shows the hovered chapter's title + is visible.
      const tooltip = el.querySelector('[part="tooltip"]') as HTMLElement;
      expect(tooltip.getAttribute('data-visible')).toBe('true');
      expect(el.querySelector('[part="tooltip-chapter"]')?.textContent).toBe('Middle');

      // Leaving clears the pop.
      slider.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
      expect(el.querySelector('[part="chapter-segment"][data-hovered]')).toBeNull();
      expect(tooltip.getAttribute('data-visible')).toBe('false');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits play/pause requests from the play button based on state', () => {
      const { host, el } = mount();
      const button = el.querySelector('[part="play-button"]') as HTMLButtonElement;

      const play: CustomEvent[] = [];
      const pause: CustomEvent[] = [];
      document.addEventListener('playerstack-play-request', (e) => play.push(e as CustomEvent));
      document.addEventListener('playerstack-pause-request', (e) => pause.push(e as CustomEvent));

      host.store.set({ playing: false });
      button.click();
      expect(play).toHaveLength(1);

      host.store.set({ playing: true });
      button.click();
      expect(pause).toHaveLength(1);
    });

    it('emits a seek request on a timeline pointerdown', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100, playing: true });

      const slider = el.querySelector('[part="slider"]') as HTMLElement;
      const track = el.querySelector('[part="track"]') as HTMLElement;
      jest.spyOn(track, 'getBoundingClientRect').mockReturnValue(RECT_100);

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      slider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 50, bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.time).toBe(50);
    });

    it('emits a seek request offset by ±10s from the skip buttons', () => {
      const { host, el } = mount();
      host.store.set({ duration: 100, seek: 40, playing: true });

      const back = el.querySelector('[part="skip-back-button"]') as HTMLButtonElement;
      const forward = el.querySelector('[part="skip-forward-button"]') as HTMLButtonElement;

      const received: Array<CustomEvent<{ time: number }>> = [];
      document.addEventListener('playerstack-seek-request', (e) => received.push(e as CustomEvent<{ time: number }>));

      back.click();
      expect(received[0]?.detail.time).toBe(30);

      forward.click();
      expect(received[1]?.detail.time).toBe(50);
    });
  });

  describe('ad mode', () => {
    it('reflects data-ad-active after play and emits an ad-skip when skippable', () => {
      const { host, el } = mount();
      el.ads = { skipAfter: 5 };

      // Pre-roll activates on the first play transition.
      host.store.set({ playing: true, seek: 0, duration: 30 });
      expect(el.getAttribute('data-ad-active')).toBe('true');

      const skips: CustomEvent[] = [];
      document.addEventListener('playerstack-ad-skip', (e) => skips.push(e as CustomEvent));

      const button = el.querySelector('[part="play-button"]') as HTMLButtonElement;

      // Before skipAfter → clicking does not skip.
      host.store.set({ seek: 2 });
      button.click();
      expect(skips).toHaveLength(0);

      // After skipAfter → clicking skips.
      host.store.set({ seek: 6 });
      button.click();
      expect(skips).toHaveLength(1);
    });

    it('shows the ORIGINAL title in initial pause and the AD title only while the ad is active', () => {
      const { host, el } = mount();
      el.title = 'Sprite Fight';
      el.chapters = [{ title: 'Intro', startTime: 0 }];
      el.ads = { title: 'Ad: Premium Music Service', skipAfter: 5 };

      const label = el.querySelector('[part="media-label"]') as HTMLElement;

      // Initial pause (ad NOT active yet): original track title + chapter, never the ad title.
      host.store.set({ playing: false, seek: 0, duration: 30 });
      expect(label.textContent).toContain('Sprite Fight');
      expect(label.textContent).not.toContain('Ad: Premium Music Service');

      // First play activates the pre-roll ad → label switches to the ad's own title (no chapter).
      host.store.set({ playing: true, seek: 1 });
      expect(label.textContent).toContain('Ad: Premium Music Service');
      expect(label.textContent).not.toContain('Sprite Fight');
    });

    it('when the ad ENDS: stays in ad mode with the ad title, and the button skips to the original', () => {
      const { host, el } = mount();
      el.title = 'Sprite Fight';
      el.chapters = [{ title: 'Intro', startTime: 0 }];
      el.ads = { title: 'Ad: Premium Music Service', skipAfter: 5 };

      const label = el.querySelector('[part="media-label"]') as HTMLElement;

      // Ad running.
      host.store.set({ playing: true, seek: 2, duration: 12 });
      expect(el.getAttribute('data-ad-active')).toBe('true');
      expect(label.textContent).toContain('Ad: Premium Music Service');

      // Ad reaches its end: it is STILL the ad (not the original) — ad mode + ad title stay, and
      // the label never becomes a "Replay:" of the original.
      host.store.set({ playing: false, seek: 12, duration: 12, isEnded: true });
      expect(el.getAttribute('data-ad-active')).toBe('true');
      expect(label.textContent).toContain('Ad: Premium Music Service');
      expect(label.textContent).toContain('Play: ');
      expect(label.textContent).not.toContain('Replay: ');

      // The button is a clickable skip-ad that moves on to the original content (the fallback if
      // auto-resume did not run), regardless of the skip timer.
      const skips: CustomEvent[] = [];
      document.addEventListener('playerstack-ad-skip', (e) => skips.push(e as CustomEvent));
      const button = el.querySelector('[part="play-button"]') as HTMLButtonElement;
      button.click();
      expect(skips).toHaveLength(1);
    });
  });
});
