import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import { formatTime } from '@utils/format';

/**
 * Spec for `playerstack-play-time` — the current-time / duration read-out UI_Element
 * (Req 3.3, 5.1, 5.2, 5.3, 17.5). As a display element it only reflects state: it verifies the
 * Markup_Contract (`part="time"` container holding `part="current-time"` and `part="duration"`
 * spans plus a decorative separator) and store→display propagation, where a store change updates
 * both spans with the shared `formatTime` output (Req 3.3).
 *
 * The element resolves the media context from an ancestor `playerstack-media-controller`, so
 * every test appends it as a light-DOM child of a connected controller and drives state via
 * `host.store`.
 */
registerPlayerstackElements();

/** Creates a connected controller host and a play-time child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-play-time');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-play-time', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="time" with current-time and duration spans', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="time"]')).not.toBeNull();
      const current = root.querySelector('[part="current-time"]');
      const duration = root.querySelector('[part="duration"]');
      expect(current).not.toBeNull();
      expect(duration).not.toBeNull();
      // Seeded with a formatted zero so the read-out is well-formed before any store update.
      expect(current?.textContent).toBe(formatTime(0));
      expect(duration?.textContent).toBe(formatTime(0));
      // Decorative separator hidden from assistive tech.
      expect(root.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→display propagation (Req 3.3)', () => {
    it('updates the current-time and duration text from the store', () => {
      const { host, el } = mount();
      const root = el;

      host.store.set({ seek: 83, duration: 296 });

      expect(root.querySelector('[part="current-time"]')?.textContent).toBe(formatTime(83));
      expect(root.querySelector('[part="duration"]')?.textContent).toBe(formatTime(296));
      // Duration known: `/ duration` + separator are visible.
      expect((root.querySelector('[part="duration"]') as HTMLElement).style.display).toBe('');
      expect((root.querySelector('[aria-hidden="true"]') as HTMLElement).style.display).toBe('');
    });

    // VOD first load: duration not known yet (0). Show only the current time (no `/ 00:00` flash);
    // reveal `/ MM:SS` once the real duration arrives.
    it('hides the "/ duration" + separator while the duration is unknown (0), then reveals it', () => {
      const { host, el } = mount();
      const current = el.querySelector('[part="current-time"]') as HTMLElement;
      const duration = el.querySelector('[part="duration"]') as HTMLElement;
      const separator = el.querySelector('[aria-hidden="true"]') as HTMLElement;

      host.store.set({ seek: 0, duration: 0 });
      expect(current.textContent).toBe(formatTime(0)); // "00:00" is fine — position is 0
      expect(current.style.display).toBe(''); // current time still shows
      expect(duration.style.display).toBe('none'); // no "/ 00:00"
      expect(separator.style.display).toBe('none');

      // Metadata arrives.
      host.store.set({ seek: 0, duration: 629 });
      expect(duration.textContent).toBe(formatTime(629));
      expect(duration.style.display).toBe('');
      expect(separator.style.display).toBe('');
    });
  });

  describe('live-DVR read-out (negative offset, hidden duration)', () => {
    it('shows the negative live offset as current-time and hides /duration when live', () => {
      const { host, el } = mount();
      const root = el;
      (el as unknown as { live: boolean }).live = true;
      (el as unknown as { liveDVR: boolean }).liveDVR = true;
      // Store feeds the DVR WINDOW: position as `seek` (60), window length as `duration` (100)
      // -> 60 - 100 = -40s behind live -> "-0:40".
      host.store.set({ seek: 60, duration: 100 });

      const current = root.querySelector('[part="current-time"]') as HTMLElement;
      const duration = root.querySelector('[part="duration"]') as HTMLElement;
      const separator = root.querySelector('[aria-hidden="true"]') as HTMLElement;
      expect(current.textContent).toBe('-0:40');
      expect(duration.style.display).toBe('none');
      expect(separator.style.display).toBe('none');
    });

    it('shows NOTHING (no 0:00) at the DVR live edge — only the LIVE badge, like YouTube', () => {
      const { host, el } = mount();
      (el as unknown as { live: boolean }).live = true;
      (el as unknown as { liveDVR: boolean }).liveDVR = true;
      host.store.set({ seek: 100, duration: 100 });
      const current = el.querySelector('[part="current-time"]') as HTMLElement;
      expect(current.textContent).toBe('');
      expect(current.style.display).toBe('none');
    });

    it('shows NOTHING on a PURE live stream (no DVR window, no offset — just the LIVE badge)', () => {
      const { host, el } = mount();
      // Pure live: `live` set but NOT `liveDVR`. The store feeds absolute time (a large live
      // position), which must NOT be shown as a bogus offset — the read-out stays hidden.
      (el as unknown as { live: boolean }).live = true;
      host.store.set({ seek: 595, duration: 605 });
      const current = el.querySelector('[part="current-time"]') as HTMLElement;
      expect(current.textContent).toBe('');
      expect(current.style.display).toBe('none');
    });

    // Regression: playing the DVR window at 1× keeps the distance to live essentially constant,
    // but `seekableEnd` (fed as `duration`) advances in ~2s segment steps while `seek` is smooth,
    // so the raw offset wobbles ~±1s. The readout must stay steady (Option A / YouTube-style).
    it('holds the offset steady through segment-step jitter (does not flicker -1:00/-1:01)', () => {
      const { host, el } = mount();
      const current = el.querySelector('[part="current-time"]') as HTMLElement;
      (el as unknown as { live: boolean }).live = true;
      (el as unknown as { liveDVR: boolean }).liveDVR = true;

      // First reading ~60s behind: seek 543.5, window 604.8 -> offset -61.3 -> "-1:01".
      host.store.set({ seek: 543.5, duration: 604.8 });
      const first = current.textContent;
      expect(first).toBe('-1:01');

      // Next frame: seek climbs to 544.5 while the window is unchanged -> raw offset -60.3
      // (would flicker to "-1:00"), but stabilization holds the shown value (within the ~2s step).
      host.store.set({ seek: 544.5, duration: 604.8 });
      expect(current.textContent).toBe(first);

      // Segment arrives: window jumps to 606.7, seek 545.5 -> raw -61.2 -> still held.
      host.store.set({ seek: 545.5, duration: 606.7 });
      expect(current.textContent).toBe(first);

      // A genuine large move (user scrubs further back) DOES update the readout.
      host.store.set({ seek: 400, duration: 606.7 });
      expect(current.textContent).toBe('-3:27'); // 400 - 606.7 = -206.7 -> -3:27
    });

    it('restores the normal MM:SS / MM:SS read-out when live is turned off', () => {
      const { host, el } = mount();
      const root = el;
      (el as unknown as { live: boolean }).live = true;
      host.store.set({ seek: 60, duration: 100 });
      (el as unknown as { live: boolean }).live = false;

      const current = root.querySelector('[part="current-time"]') as HTMLElement;
      const duration = root.querySelector('[part="duration"]') as HTMLElement;
      expect(current.textContent).toBe(formatTime(60));
      expect(duration.style.display).toBe('');
    });
  });
});
