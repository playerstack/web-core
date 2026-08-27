import { LiveAdController, EXIT_DURATION_MS } from '@live-ad-controller';
import type { LiveAdAdapter } from '@typings/adapters.types';

/**
 * Spec for `LiveAdController` — the framework-agnostic live-ad phase machine
 * (idle → playing → exiting → idle). A fake adapter records stream/ad I/O so the phase
 * transitions, skip availability/countdown, exit timer and callbacks can be asserted without DOM.
 */
function createMockAdapter(): LiveAdAdapter & {
  suppressActive: boolean;
  restored: Array<boolean>;
  opened: string[];
  released: number;
} {
  const state = { suppressActive: false, restored: [] as boolean[], opened: [] as string[], released: 0 };
  return {
    suppressActive: false,
    restored: state.restored,
    opened: state.opened,
    released: 0,
    muteStream: jest.fn(() => false),
    restoreStream: jest.fn((wasMuted: boolean) => {
      state.restored.push(wasMuted);
    }),
    suppressStreamPause: jest.fn(function (this: { suppressActive: boolean }) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      self.suppressActive = true;
      return () => {
        self.suppressActive = false;
      };
    }),
    releaseAd: jest.fn(function (this: { released: number }) {
      this.released += 1;
    }),
    openUrl: jest.fn((url: string) => {
      state.opened.push(url);
    }),
  };
}

describe('LiveAdController', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const cfg = (over = {}) => ({ url: 'ad.mp4', title: 'Ad', clickUrl: 'https://x', skipAfter: 5, ...over });

  it('starts idle', () => {
    const controller = new LiveAdController(createMockAdapter());
    expect(controller.phase).toBe('idle');
    expect(controller.state.isActive).toBe(false);
    controller.destroy();
  });

  it('triggerAd enters playing, mutes the stream + suppresses pause, fires onStart', () => {
    const adapter = createMockAdapter();
    const controller = new LiveAdController(adapter);
    const onStart = jest.fn();
    controller.triggerAd(cfg({ onStart }));

    expect(controller.phase).toBe('playing');
    expect(adapter.muteStream).toHaveBeenCalled();
    expect(adapter.suppressStreamPause).toHaveBeenCalled();
    expect(controller.state.url).toBe('ad.mp4');
    expect(onStart).toHaveBeenCalled();
    controller.destroy();
  });

  it('ignores a triggerAd without a URL or while already active', () => {
    const controller = new LiveAdController(createMockAdapter());
    controller.triggerAd({ url: '' });
    expect(controller.phase).toBe('idle');

    controller.triggerAd(cfg());
    controller.triggerAd(cfg({ url: 'other.mp4' })); // ignored — already playing
    expect(controller.state.url).toBe('ad.mp4');
    controller.destroy();
  });

  it('computes canSkip / skipCountdown from progress', () => {
    const controller = new LiveAdController(createMockAdapter());
    controller.triggerAd(cfg({ skipAfter: 5 }));

    controller.updateProgress(2, 30);
    expect(controller.state.canSkip).toBe(false);
    expect(controller.state.skipCountdown).toBe(3);

    controller.updateProgress(5, 30);
    expect(controller.state.canSkip).toBe(true);
    expect(controller.state.skipCountdown).toBe(0);
    controller.destroy();
  });

  it('adEnded fires onComplete then exits and restores after EXIT_DURATION_MS', () => {
    const adapter = createMockAdapter();
    const controller = new LiveAdController(adapter);
    const onComplete = jest.fn();
    controller.triggerAd(cfg({ onComplete }));

    controller.adEnded();
    expect(onComplete).toHaveBeenCalled();
    expect(controller.phase).toBe('exiting');

    jest.advanceTimersByTime(EXIT_DURATION_MS);
    expect(controller.phase).toBe('idle');
    expect(adapter.restoreStream).toHaveBeenCalledWith(false);
    expect(adapter.releaseAd).toHaveBeenCalled();
    controller.destroy();
  });

  it('skipAd fires onSkip and exits (only while playing)', () => {
    const controller = new LiveAdController(createMockAdapter());
    const onSkip = jest.fn();
    controller.triggerAd(cfg({ onSkip }));

    controller.skipAd();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(controller.phase).toBe('exiting');

    controller.skipAd(); // no-op now (not playing)
    expect(onSkip).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('clickAd opens the click URL and fires onClick', () => {
    const adapter = createMockAdapter();
    const controller = new LiveAdController(adapter);
    const onClick = jest.fn();
    controller.triggerAd(cfg({ clickUrl: 'https://sponsor', onClick }));

    controller.clickAd();
    expect(adapter.openUrl).toHaveBeenCalledWith('https://sponsor');
    expect(onClick).toHaveBeenCalled();
    controller.destroy();
  });

  it('_beginExit is idempotent (no stacked timers)', () => {
    const adapter = createMockAdapter();
    const controller = new LiveAdController(adapter);
    controller.triggerAd(cfg());
    controller.adEnded();
    controller.skipAd(); // already exiting — should not re-schedule
    jest.advanceTimersByTime(EXIT_DURATION_MS);
    expect(adapter.restoreStream).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('emits stateChange on transitions', () => {
    const controller = new LiveAdController(createMockAdapter());
    const handler = jest.fn();
    controller.on('stateChange', handler);
    controller.triggerAd(cfg());
    controller.updateProgress(1, 30);
    controller.adEnded();
    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(3);
    controller.destroy();
  });

  it('destroy during an ad restores the stream and releases the ad', () => {
    const adapter = createMockAdapter();
    const controller = new LiveAdController(adapter);
    controller.triggerAd(cfg());
    controller.destroy();
    expect(adapter.restoreStream).toHaveBeenCalledWith(false);
    expect(adapter.releaseAd).toHaveBeenCalled();
  });
});
