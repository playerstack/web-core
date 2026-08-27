/**
 * Engine selection on iOS depending on ManagedMediaSource (MMS) availability.
 *
 * Rationale: iPhone Safari only gained an MSE-class API (ManagedMediaSource) in iOS 17.1.
 * When present, hls.js can run and expose a real seekable window (live-DVR seek-back works);
 * without it, hls.js cannot run on iPhone and native HLS is the only path.
 *
 * These tests mock the platform constants and the SDK loader so no network/script load happens.
 */

describe('MediaEngine — iOS engine selection (ManagedMediaSource)', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadWith(flags: { ios: boolean; mms: boolean }): {
    getSDK: jest.Mock;
    srcAtLoad: string;
  } {
    let result!: { getSDK: jest.Mock; srcAtLoad: string };
    jest.isolateModules(() => {
      const getSDK = jest.fn(() => new Promise(() => {})); // never resolves — avoids real loading
      jest.doMock('@utils/sdk', () => ({ getSDK }));
      jest.doMock('@constants', () => {
        const actual = jest.requireActual('@constants');
        return { ...actual, IS_IOS: flags.ios, IS_SAFARI: false, IS_MMS_SUPPORTED: flags.mms };
      });

      const { MediaEngine } = require('@media-engine');
      const video = document.createElement('video');
      video.play = jest.fn().mockResolvedValue(undefined);
      const engine = new MediaEngine(video);
      engine.load('https://example.com/live.m3u8');
      // Read src BEFORE destroy() (which strips it) so the native-vs-hls path is observable.
      result = { getSDK, srcAtLoad: video.getAttribute('src') || '' };
      engine.destroy();
    });
    return result;
  }

  it('uses hls.js on iOS when ManagedMediaSource is available (iOS 17.1+)', () => {
    const { getSDK, srcAtLoad } = loadWith({ ios: true, mms: true });
    // hls.js path loads the SDK and attaches its own buffer instead of setting the src.
    expect(getSDK).toHaveBeenCalledTimes(1);
    expect(srcAtLoad).toBe('');
  });

  it('falls back to native HLS on iOS without ManagedMediaSource (iOS < 17.1)', () => {
    const { getSDK, srcAtLoad } = loadWith({ ios: true, mms: false });
    // Native path: no SDK load, the element src is set to the stream URL.
    expect(getSDK).not.toHaveBeenCalled();
    expect(srcAtLoad).toContain('live.m3u8');
  });
});
