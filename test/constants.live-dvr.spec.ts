/**
 * IS_LIVE_DVR_SUPPORTED derivation.
 *
 * DVR seek-back needs an MSE-class engine (hls.js). On iOS that requires ManagedMediaSource
 * (iOS 17.1+); without it native HLS is used and the live window is not seekable. Everywhere
 * else DVR is available. The constant is evaluated at module load from navigator + the global,
 * so each case re-requires the module in isolation with a mocked environment.
 */

describe('IS_LIVE_DVR_SUPPORTED', () => {
  const originalUA = navigator.userAgent;
  const hadMMS = 'ManagedMediaSource' in globalThis;

  const setUA = (ua: string) => {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  };

  afterEach(() => {
    setUA(originalUA);
    if (!hadMMS) delete (globalThis as any).ManagedMediaSource;
    jest.resetModules();
  });

  function evalSupported(): boolean {
    let value = false;
    jest.isolateModules(() => {
      value = require('@constants').IS_LIVE_DVR_SUPPORTED;
    });
    return value;
  }

  it('false on iPhone WITHOUT ManagedMediaSource (iOS < 17.1 → native HLS, no DVR)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    delete (globalThis as any).ManagedMediaSource;
    expect(evalSupported()).toBe(false);
  });

  it('true on iPhone WITH ManagedMediaSource (iOS 17.1+ → hls.js can time-shift)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15');
    (globalThis as any).ManagedMediaSource = function ManagedMediaSource() {};
    expect(evalSupported()).toBe(true);
  });

  it('true on a non-iOS platform regardless of ManagedMediaSource', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
    delete (globalThis as any).ManagedMediaSource;
    expect(evalSupported()).toBe(true);
  });
});
