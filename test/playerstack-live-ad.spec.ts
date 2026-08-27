import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';
import type { LiveAdAdapter } from '@typings/adapters.types';
import type { LiveAdConfig } from '@typings/live-ad-controller.types';

/**
 * Spec for `playerstack-live-ad` — the Twitch-style live ad break overlay UI_Element. A fake
 * stream `LiveAdAdapter` records the stream I/O so the element's markup, controller wiring
 * (trigger → playing → skip/ended → exiting), skip label/countdown, progress and `data-active`/
 * `data-exiting` reflection can be asserted without a real `<video>`.
 */
registerPlayerstackElements();

function createAdapter(): LiveAdAdapter & { suppressed: boolean } {
  const state = { suppressed: false };
  return {
    suppressed: false,
    muteStream: jest.fn(() => false),
    restoreStream: jest.fn(),
    suppressStreamPause: jest.fn(() => {
      state.suppressed = true;
      return () => {
        state.suppressed = false;
      };
    }),
    releaseAd: jest.fn(),
    openUrl: jest.fn(),
  };
}

function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-live-ad');
  host.appendChild(el);
  return { host, el };
}

const cfg = (over: Partial<LiveAdConfig> = {}): LiveAdConfig => ({
  url: 'ad.mp4',
  title: 'Chromecast Ad',
  clickUrl: 'https://store.google.com',
  buttonText: 'Visit site',
  skipAfter: 5,
  ...over,
});

describe('playerstack-live-ad', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders the markup contract, hidden while idle', () => {
    const { el } = mount();
    expect(el.querySelector('[part="live-ad"]')).not.toBeNull();
    expect(el.querySelector('[part="live-ad-video"]')).not.toBeNull();
    expect(el.querySelector('[part="live-ad-skip"]')).not.toBeNull();
    expect((el.querySelector('[part="live-ad"]') as HTMLElement).style.display).toBe('none');
  });

  it('activates on triggerAd: shows overlay, mutes stream, sets ad src + labels', () => {
    const { el } = mount();
    const adapter = createAdapter();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = adapter;
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg());

    expect(adapter.muteStream).toHaveBeenCalled();
    expect(adapter.suppressStreamPause).toHaveBeenCalled();
    const overlay = el.querySelector('[part="live-ad"]') as HTMLElement;
    expect(overlay.style.display).toBe('');
    expect(el.getAttribute('data-active')).toBe('true');
    expect((el.querySelector('[part="live-ad-video"]') as HTMLElement).getAttribute('src')).toBe('ad.mp4');
    expect((el.querySelector('[part="live-ad-info"]') as HTMLElement).textContent).toBe('Chromecast Ad');
    expect((el.querySelector('[part="live-ad-badge"]') as HTMLElement).textContent).toBe('AD');
    expect((el.querySelector('[part="live-ad-stream-badge"]') as HTMLElement).textContent).toBe('Live Stream');
    expect((el.querySelector('[part="live-ad-cta"]') as HTMLElement).textContent).toBe('Visit site');
  });

  // A trigger that arrives BEFORE the adapter (the skin resolves the <video> async, so the
  // `trigger` prop can be applied before `adapter`) must not be dropped — it fires once the
  // controller is built on adapter injection.
  it('fires a break requested BEFORE the adapter was injected (pending trigger)', () => {
    const { el } = mount();
    // Trigger first — no adapter yet, so no controller: the break is stashed.
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg());
    const overlay = el.querySelector('[part="live-ad"]') as HTMLElement;
    expect(overlay.style.display).toBe('none');

    // Now inject the adapter — the pending break must fire immediately.
    const adapter = createAdapter();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = adapter;

    expect(adapter.muteStream).toHaveBeenCalled();
    expect(overlay.style.display).toBe('');
    expect(el.getAttribute('data-active')).toBe('true');
    expect((el.querySelector('[part="live-ad-video"]') as HTMLElement).getAttribute('src')).toBe('ad.mp4');
  });

  it('applies the trigger via the `trigger` property channel (equivalent to triggerAd)', () => {
    const { el } = mount();
    const adapter = createAdapter();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = adapter;
    (el as unknown as { trigger: LiveAdConfig | null }).trigger = cfg();

    expect(adapter.muteStream).toHaveBeenCalled();
    expect((el.querySelector('[part="live-ad"]') as HTMLElement).style.display).toBe('');
  });

  it('shows the skip countdown, then enables skip once past skipAfter', () => {
    const { el } = mount();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = createAdapter();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg({ skipAfter: 5 }));

    const adVideo = el.querySelector('[part="live-ad-video"]') as HTMLVideoElement;
    const skip = el.querySelector('[part="live-ad-skip"]') as HTMLElement;

    Object.defineProperty(adVideo, 'currentTime', { value: 2, configurable: true });
    Object.defineProperty(adVideo, 'duration', { value: 30, configurable: true });
    adVideo.dispatchEvent(new Event('timeupdate'));
    expect(skip.getAttribute('data-can-skip')).toBe('false');
    expect(skip.textContent).toBe('Skip in 3s');

    Object.defineProperty(adVideo, 'currentTime', { value: 5, configurable: true });
    adVideo.dispatchEvent(new Event('timeupdate'));
    expect(skip.getAttribute('data-can-skip')).toBe('true');
    expect(skip.textContent).toBe('Skip Ad');
  });

  it('paints the progress bar scaleX from ad progress', () => {
    const { el } = mount();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = createAdapter();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg({ skipAfter: 0 }));
    const adVideo = el.querySelector('[part="live-ad-video"]') as HTMLVideoElement;
    Object.defineProperty(adVideo, 'currentTime', { value: 5, configurable: true });
    Object.defineProperty(adVideo, 'duration', { value: 20, configurable: true });
    adVideo.dispatchEvent(new Event('timeupdate'));
    const bar = el.querySelector('[part="live-ad-progress-bar"]') as HTMLElement;
    expect(bar.style.transform).toBe('scaleX(0.25)');
  });

  it('clicking a skippable ad exits (data-exiting) then restores the stream after the exit timer', () => {
    const { el } = mount();
    const adapter = createAdapter();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = adapter;
    const onSkip = jest.fn();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg({ skipAfter: 0, onSkip }));

    (el.querySelector('[part="live-ad-skip"]') as HTMLButtonElement).click();
    expect(onSkip).toHaveBeenCalled();
    expect((el.querySelector('[part="live-ad"]') as HTMLElement).getAttribute('data-exiting')).toBe('true');

    jest.advanceTimersByTime(400);
    expect(adapter.restoreStream).toHaveBeenCalledWith(false);
    expect(adapter.releaseAd).toHaveBeenCalled();
    expect(el.getAttribute('data-active')).toBeNull();
  });

  it('CTA click routes through the controller (openUrl + onClick)', () => {
    const { el } = mount();
    const adapter = createAdapter();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = adapter;
    const onClick = jest.fn();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg({ clickUrl: 'https://x', onClick }));
    (el.querySelector('[part="live-ad-cta"]') as HTMLButtonElement).click();
    expect(adapter.openUrl).toHaveBeenCalledWith('https://x');
    expect(onClick).toHaveBeenCalled();
  });

  // The ad `<video>` has `autoplay`, but browsers block autoplay-with-sound without a user
  // gesture; a programmatically-triggered break must not sit paused. The element explicitly
  // starts playback when the ad src is set.
  it('starts ad playback when the break activates', () => {
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { el } = mount();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = createAdapter();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg());
    expect(play).toHaveBeenCalled();
    play.mockRestore();
  });

  // If autoplay-with-sound is rejected by the browser policy, the ad falls back to a muted start
  // (the stream is already muted behind it) so it always plays.
  it('falls back to a muted start when autoplay-with-sound is rejected', async () => {
    const play = jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    const { el } = mount();
    (el as unknown as { adapter: LiveAdAdapter }).adapter = createAdapter();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg());
    // Let the rejected play() promise settle so the muted retry runs.
    await Promise.resolve();
    await Promise.resolve();
    const adVideo = el.querySelector('[part="live-ad-video"]') as HTMLVideoElement;
    expect(adVideo.muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
    play.mockRestore();
  });

  it('localizes labels via the language attribute (es)', () => {
    const { el } = mount();
    el.setAttribute('language', 'es');
    (el as unknown as { adapter: LiveAdAdapter }).adapter = createAdapter();
    (el as unknown as { triggerAd: (c: LiveAdConfig) => void }).triggerAd(cfg({ skipAfter: 5 }));
    expect((el.querySelector('[part="live-ad-stream-badge"]') as HTMLElement).textContent).toBe('Transmisión en vivo');
    const skip = el.querySelector('[part="live-ad-skip"]') as HTMLElement;
    const adVideo = el.querySelector('[part="live-ad-video"]') as HTMLVideoElement;
    Object.defineProperty(adVideo, 'currentTime', { value: 1, configurable: true });
    adVideo.dispatchEvent(new Event('timeupdate'));
    expect(skip.textContent).toBe('Omitir en 4s');
  });
});
