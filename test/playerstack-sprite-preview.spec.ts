import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { SpriteAdapter } from '@typings/adapters.types';

/**
 * Spec for `playerstack-sprite-preview` — the scrub thumbnail preview UI_Element. A fake
 * `SpriteAdapter` supplies the VTT text, sheet sizes and container size (no DOM fetch/Image), so
 * the element's load → parse → frame-paint pipeline and `data-visible` reflection can be asserted
 * deterministically. The frame MATH is the shared pure `computeSpriteFrame`.
 */
registerPlayerstackElements();

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
sheet.png#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
sheet.png#xywh=160,0,160,90
`;

function createAdapter(over: Partial<SpriteAdapter> = {}): SpriteAdapter {
  return {
    fetchVtt: jest.fn(() => Promise.resolve(VTT)),
    loadSheetSizes: jest.fn(() => Promise.resolve({ 'https://cdn/sheet.png': { w: 320, h: 90 } })),
    getContainerSize: jest.fn(() => ({ width: 640, height: 360 })),
    ...over,
  };
}

function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-sprite-preview');
  host.appendChild(el);
  return { host, el };
}

/** Flush pending microtasks (the async load in the element). */
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('playerstack-sprite-preview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders the container + frame parts, hidden by default', () => {
    const { el } = mount();
    const container = el.querySelector('[part="sprite-preview"]') as HTMLElement;
    const frame = el.querySelector('[part="sprite-preview-frame"]') as HTMLElement;
    expect(container).not.toBeNull();
    expect(frame).not.toBeNull();
    expect(container.getAttribute('data-visible')).toBe('false');
  });

  it('loads the sprite via the adapter and paints a frame when visible + scrubbing', async () => {
    const { el } = mount();
    const adapter = createAdapter();
    (el as unknown as { adapter: SpriteAdapter }).adapter = adapter;
    (el as unknown as { spriteVttFile: string }).spriteVttFile = 'https://cdn/sprite.vtt';
    (el as unknown as { duration: number }).duration = 10;
    (el as unknown as { seekTime: number }).seekTime = 2;
    (el as unknown as { visible: boolean }).visible = true;
    await flush();

    expect(adapter.fetchVtt).toHaveBeenCalledWith('https://cdn/sprite.vtt');
    const container = el.querySelector('[part="sprite-preview"]') as HTMLElement;
    const frame = el.querySelector('[part="sprite-preview-frame"]') as HTMLElement;
    expect(container.getAttribute('data-visible')).toBe('true');
    expect(frame.style.backgroundImage).toContain('sheet.png');
    expect(frame.style.display).toBe('');
  });

  it('stays hidden while not visible even after loading', async () => {
    const { el } = mount();
    (el as unknown as { adapter: SpriteAdapter }).adapter = createAdapter();
    (el as unknown as { spriteVttFile: string }).spriteVttFile = 'https://cdn/sprite.vtt';
    (el as unknown as { duration: number }).duration = 10;
    (el as unknown as { seekTime: number }).seekTime = 2;
    (el as unknown as { visible: boolean }).visible = false;
    await flush();
    const container = el.querySelector('[part="sprite-preview"]') as HTMLElement;
    expect(container.getAttribute('data-visible')).toBe('false');
  });

  it('resolves relative sheet paths against the VTT base URL', async () => {
    const { el } = mount();
    const loadSheetSizes = jest.fn(() => Promise.resolve({ 'https://cdn/sub/sheet.png': { w: 320, h: 90 } }));
    (el as unknown as { adapter: SpriteAdapter }).adapter = createAdapter({ loadSheetSizes });
    (el as unknown as { spriteVttFile: string }).spriteVttFile = 'https://cdn/sub/sprite.vtt';
    (el as unknown as { duration: number }).duration = 10;
    (el as unknown as { visible: boolean }).visible = true;
    (el as unknown as { seekTime: number }).seekTime = 2;
    await flush();
    // The relative `sheet.png` was resolved to the VTT's base URL before measuring.
    expect(loadSheetSizes).toHaveBeenCalledWith(['https://cdn/sub/sheet.png']);
  });

  it('does not throw and stays hidden when the fetch fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { el } = mount();
    (el as unknown as { adapter: SpriteAdapter }).adapter = createAdapter({
      fetchVtt: jest.fn(() => Promise.reject(new Error('net'))),
    });
    (el as unknown as { spriteVttFile: string }).spriteVttFile = 'https://cdn/sprite.vtt';
    (el as unknown as { visible: boolean }).visible = true;
    await flush();
    const container = el.querySelector('[part="sprite-preview"]') as HTMLElement;
    expect(container.getAttribute('data-visible')).toBe('false');
    spy.mockRestore();
  });
});
