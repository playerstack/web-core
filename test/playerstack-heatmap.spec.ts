import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { HeatmapDataPoint } from '@typings/heatmap.types';

/**
 * Spec for `playerstack-heatmap` — the "most replayed" heatmap graph UI_Element (Req 3.3, 5.1,
 * 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="heatmap"` container with an inline
 * `part="heatmap-svg"` `<svg>` and a `part="heatmap-path"` `<path>`), and store→display
 * propagation: with data points assigned and a duration set, the generated stroke `d` becomes
 * non-empty and `data-active` is reflected (Req 3.3).
 */
registerPlayerstackElements();

/** Heatmap data points matching the real `HeatmapDataPoint` shape (`startTime`/`endTime`/`value`). */
const HEATMAP: HeatmapDataPoint[] = [
  { startTime: 0, endTime: 25, value: 0.2 },
  { startTime: 25, endTime: 50, value: 0.9 },
  { startTime: 50, endTime: 75, value: 0.5 },
  { startTime: 75, endTime: 100, value: 0.1 },
];

/** Creates a connected controller host and a heatmap child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-heatmap');
  host.appendChild(el);
  return { host, el };
}

describe('playerstack-heatmap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="heatmap" with an inline svg and a path', () => {
      const { el } = mount();
      const root = el;

      expect(root.querySelector('[part="heatmap"]')).not.toBeNull();
      const svg = root.querySelector('[part="heatmap-svg"]');
      expect(svg).not.toBeNull();
      expect(svg?.tagName.toLowerCase()).toBe('svg');
      expect(root.querySelector('[part="heatmap-path"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] }).heatmapData = HEATMAP;
      host.store.set({ duration: 100 });
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('store→display propagation (Req 3.3)', () => {
    it('sets a non-empty path d and reflects data-active once data and duration are present', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] }).heatmapData = HEATMAP;

      host.store.set({ duration: 100 });

      const path = (el).querySelector('[part="heatmap-path"]');
      expect(path?.getAttribute('d')?.length).toBeGreaterThan(0);
      expect(el.getAttribute('data-active')).toBe('true');
    });

    // The bright played overlay traces the SAME curve as the base path (revealed by the clip).
    it('mirrors the same d onto the bright played-overlay path', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] }).heatmapData = HEATMAP;
      host.store.set({ duration: 100 });

      const base = el.querySelector('[part="heatmap-path"]');
      const played = el.querySelector('[part="heatmap-path-played"]');
      expect(played).not.toBeNull();
      expect(played?.getAttribute('d')).toBe(base?.getAttribute('d'));
      // The played path is clipped so only the played fraction shows.
      expect(played?.getAttribute('clip-path') ?? '').toMatch(/^url\(#playerstack-heatmap-played-\d+\)$/);
    });

    // Playback progress drives the played-overlay clip rect width (0-100 in the 0-100 viewBox).
    it('sizes the played clip rect to the played percentage from the store seek', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] }).heatmapData = HEATMAP;
      host.store.set({ duration: 100, seek: 0 });

      const rect = el.querySelector('clipPath rect') as SVGRectElement;
      expect(rect.getAttribute('width')).toBe('0');

      host.store.set({ duration: 100, seek: 40 });
      expect(rect.getAttribute('width')).toBe('40');

      // Clamp: a seek beyond duration caps at 100.
      host.store.set({ duration: 100, seek: 250 });
      expect(rect.getAttribute('width')).toBe('100');
    });
  });

  describe('heatmapData input handling (Req 1.6)', () => {
    it('exposes the tracked data points via the getter', () => {
      const { el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] | null }).heatmapData = HEATMAP;
      expect((el as unknown as { heatmapData: HeatmapDataPoint[] | null }).heatmapData).toEqual(HEATMAP);
    });

    it('produces an empty path and inactive state when data is cleared to null', () => {
      const { host, el } = mount();
      (el as unknown as { heatmapData: HeatmapDataPoint[] | null }).heatmapData = HEATMAP;
      host.store.set({ duration: 100 });
      (el as unknown as { heatmapData: HeatmapDataPoint[] | null }).heatmapData = null;

      const path = (el).querySelector('[part="heatmap-path"]');
      expect(path?.getAttribute('d')).toBe('');
      expect(el.getAttribute('data-active')).toBe('false');
    });

    it('computes the path from data and store duration present before connect', () => {
      // Assigning data while detached exercises the pre-render guard in updatePath;
      // connecting under a host whose store already has a duration computes the path
      // from the resolved context on render.
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      host.store.set({ duration: 100 });

      const el = document.createElement('playerstack-heatmap');
      (el as unknown as { heatmapData: HeatmapDataPoint[] }).heatmapData = HEATMAP; // detached: guard path
      host.appendChild(el); // connect: render computes path from resolved store state

      const path = (el).querySelector('[part="heatmap-path"]');
      expect((path?.getAttribute('d')?.length ?? 0) > 0).toBe(true);
      expect(el.getAttribute('data-active')).toBe('true');
    });
  });
});
