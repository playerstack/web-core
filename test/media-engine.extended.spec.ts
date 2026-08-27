import { MediaEngine } from '@media-engine';

// Mock getSDK to control SDK loading
jest.mock('../src/utils/sdk', () => ({
  getGlobal: jest.fn(),
  getSDK: jest.fn(),
}));

import { getSDK } from '@utils/sdk';

const mockedGetSDK = getSDK as jest.MockedFunction<typeof getSDK>;

function createMockVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  video.play = jest.fn().mockResolvedValue(undefined);
  video.pause = jest.fn();
  video.load = jest.fn();

  // Mock buffered TimeRanges
  Object.defineProperty(video, 'buffered', {
    get: () => ({
      length: 1,
      start: () => 0,
      end: () => 30,
    }),
  });

  // Mock seekable for live streams
  Object.defineProperty(video, 'seekable', {
    get: () => ({
      length: 0,
      start: () => 0,
      end: () => 0,
    }),
    configurable: true,
  });

  return video;
}

describe('MediaEngine - extended coverage', () => {
  let video: HTMLVideoElement;
  let engine: MediaEngine;

  beforeEach(() => {
    video = createMockVideo();
    mockedGetSDK.mockReset();
  });

  afterEach(() => {
    engine?.destroy();
  });

  describe('seekTo', () => {
    it('sets currentTime', () => {
      engine = new MediaEngine(video);
      engine.seekTo(42);
      expect(video.currentTime).toBe(42);
    });

    it('pauses when keepPlaying=false', () => {
      engine = new MediaEngine(video);
      engine.seekTo(10, false);
      expect(video.pause).toHaveBeenCalled();
    });
  });

  describe('getPlaybackRate', () => {
    it('returns current playback rate', () => {
      engine = new MediaEngine(video);
      video.playbackRate = 1.5;
      expect(engine.getPlaybackRate()).toBe(1.5);
    });
  });

  describe('isMuted', () => {
    it('returns muted state', () => {
      engine = new MediaEngine(video);
      video.muted = true;
      expect(engine.isMuted()).toBe(true);
    });
  });

  describe('getDuration', () => {
    it('returns duration when finite', () => {
      engine = new MediaEngine(video);
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      expect(engine.getDuration()).toBe(120);
    });

    it('returns seekable end when duration is Infinity', () => {
      engine = new MediaEngine(video);
      Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
      Object.defineProperty(video, 'seekable', {
        get: () => ({
          length: 1,
          start: () => 0,
          end: (i: number) => 300,
        }),
        configurable: true,
      });
      expect(engine.getDuration()).toBe(300);
    });

    it('returns 0 when duration is NaN', () => {
      engine = new MediaEngine(video);
      Object.defineProperty(video, 'duration', { value: NaN, configurable: true });
      expect(engine.getDuration()).toBe(0);
    });
  });

  describe('getCurrentTime', () => {
    it('returns currentTime from element', () => {
      engine = new MediaEngine(video);
      Object.defineProperty(video, 'currentTime', { value: 55, writable: true, configurable: true });
      expect(engine.getCurrentTime()).toBe(55);
    });
  });

  describe('getSecondsLoaded', () => {
    it('returns buffered end', () => {
      engine = new MediaEngine(video);
      expect(engine.getSecondsLoaded()).toBe(30);
    });
  });

  describe('getState', () => {
    it('returns complete state object', () => {
      engine = new MediaEngine(video);
      const state = engine.getState();
      expect(state.playing).toBe(false);
      expect(state.paused).toBe(true);
      expect(state.ended).toBe(false);
      expect(state.volume).toBe(1);
      expect(state.muted).toBe(false);
      expect(state.playbackRate).toBe(1);
      expect(state.loop).toBe(false);
    });
  });

  describe('setPlaybackRate error handling', () => {
    it('emits error when setting rate throws', () => {
      engine = new MediaEngine(video);
      const errorHandler = jest.fn();
      engine.on('error', errorHandler);
      Object.defineProperty(video, 'playbackRate', {
        set: () => { throw new Error('Not supported'); },
        get: () => 1,
        configurable: true,
      });
      engine.setPlaybackRate(3);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('play error handling', () => {
    it('emits error when play rejects', async () => {
      video.play = jest.fn().mockRejectedValue(new Error('Autoplay blocked'));
      engine = new MediaEngine(video);
      const errorHandler = jest.fn();
      engine.on('error', errorHandler);
      await engine.play();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('DOM events', () => {
    it('emits play event with hasAudio info', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('play', handler);
      video.dispatchEvent(new Event('play'));
      expect(handler).toHaveBeenCalledWith({ hasAudio: false });
    });

    it('emits ended event', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('ended', handler);
      video.dispatchEvent(new Event('ended'));
      expect(handler).toHaveBeenCalled();
    });

    it('emits buffer event on waiting', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('buffer', handler);
      video.dispatchEvent(new Event('waiting'));
      expect(handler).toHaveBeenCalled();
    });

    it('emits bufferEnd event on playing', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('bufferEnd', handler);
      video.dispatchEvent(new Event('playing'));
      expect(handler).toHaveBeenCalled();
    });

    it('emits seek event on seeked', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('seek', handler);
      video.dispatchEvent(new Event('seeked'));
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('emits error event on error', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('error', handler);
      video.dispatchEvent(new Event('error'));
      expect(handler).toHaveBeenCalled();
    });

    it('emits playbackRateChange on ratechange', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('playbackRateChange', handler);
      video.playbackRate = 2;
      video.dispatchEvent(new Event('ratechange'));
      expect(handler).toHaveBeenCalledWith(2);
    });

    it('emits ready on canplay', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('ready', handler);
      video.dispatchEvent(new Event('canplay'));
      expect(handler).toHaveBeenCalled();
    });

    it('emits durationChange on durationchange', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('durationChange', handler);
      Object.defineProperty(video, 'duration', { value: 60, configurable: true });
      video.dispatchEvent(new Event('durationchange'));
      expect(handler).toHaveBeenCalledWith(60);
    });

    it('emits timeUpdate on timeupdate', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('timeUpdate', handler);
      video.dispatchEvent(new Event('timeupdate'));
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('emits volumeChange on volumechange', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('volumeChange', handler);
      video.volume = 0.7;
      video.dispatchEvent(new Event('volumechange'));
      expect(handler).toHaveBeenCalledWith(0.7, false);
    });

    it('emits progress on progress event', () => {
      engine = new MediaEngine(video);
      const handler = jest.fn();
      engine.on('progress', handler);
      video.dispatchEvent(new Event('progress'));
      expect(handler).toHaveBeenCalledWith(30);
    });
  });

  describe('HLS loading', () => {
    it('loads HLS SDK for m3u8 URLs', async () => {
      const mockHlsInstance = {
        on: jest.fn(),
        loadSource: jest.fn(),
        attachMedia: jest.fn(),
        destroy: jest.fn(),
      };
      const MockHls: any = jest.fn(() => mockHlsInstance);
      MockHls.Events = { MANIFEST_PARSED: 'MANIFEST_PARSED', ERROR: 'ERROR' };

      mockedGetSDK.mockResolvedValue(MockHls);

      engine = new MediaEngine(video);
      engine.load('https://example.com/stream.m3u8');

      await new Promise((r) => setTimeout(r, 0));

      expect(mockedGetSDK).toHaveBeenCalled();
      expect(MockHls).toHaveBeenCalled();
      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://example.com/stream.m3u8');
      expect(mockHlsInstance.attachMedia).toHaveBeenCalledWith(video);
    });

    // Buffer profile per live mode: pure live trims the back-buffer (viewer never seeks back),
    // but DVR must RETAIN the back-buffer so the seeked-to past is playable (otherwise currentTime
    // freezes on an evicted buffer while the edge advances).
    const makeMockHls = () => {
      const inst = { on: jest.fn(), loadSource: jest.fn(), attachMedia: jest.fn(), destroy: jest.fn() };
      const Ctor: any = jest.fn(() => inst);
      Ctor.Events = { MANIFEST_PARSED: 'MANIFEST_PARSED', LEVEL_UPDATED: 'LEVEL_UPDATED', ERROR: 'ERROR' };
      return Ctor;
    };

    it('pure live trims the back-buffer and starts at the live edge', async () => {
      const MockHls = makeMockHls();
      mockedGetSDK.mockResolvedValue(MockHls);
      engine = new MediaEngine(video, { live: true });
      engine.load('https://example.com/live.m3u8');
      await new Promise((r) => setTimeout(r, 0));
      // Trimmed back-buffer + start at the live edge (startPosition -1) so the LIVE badge is red.
      expect(MockHls.mock.calls[0][0]).toMatchObject({
        maxBufferLength: 30,
        backBufferLength: 30,
        startPosition: -1,
        liveSyncDuration: 3,
      });
    });

    it('live DVR retains the back-buffer AND starts at the live edge', async () => {
      const MockHls = makeMockHls();
      mockedGetSDK.mockResolvedValue(MockHls);
      engine = new MediaEngine(video, { live: true, liveDVR: true });
      engine.load('https://example.com/live.m3u8');
      await new Promise((r) => setTimeout(r, 0));
      expect(MockHls.mock.calls[0][0]).toMatchObject({
        backBufferLength: Infinity,
        startPosition: -1,
        liveSyncDuration: 3,
      });
    });

    it('non-live streams apply no live buffer defaults', async () => {
      const MockHls = makeMockHls();
      mockedGetSDK.mockResolvedValue(MockHls);
      engine = new MediaEngine(video, { forceHLS: true });
      engine.load('https://example.com/vod.m3u8');
      await new Promise((r) => setTimeout(r, 0));
      const opts = MockHls.mock.calls[0][0];
      expect(opts.backBufferLength).toBeUndefined();
      expect(opts.maxBufferLength).toBeUndefined();
    });
  });

  describe('DASH loading', () => {
    it('loads DASH SDK for mpd URLs', async () => {
      const mockPlayer = {
        create: jest.fn().mockReturnThis(),
        initialize: jest.fn(),
        on: jest.fn(),
        updateSettings: jest.fn(),
        reset: jest.fn(),
      };
      const mockDashjs: any = {
        MediaPlayer: jest.fn(() => mockPlayer),
        LogLevel: { LOG_LEVEL_NONE: 0 },
      };

      mockedGetSDK.mockResolvedValue(mockDashjs);

      engine = new MediaEngine(video, { dashVersion: '4.7.4' });
      engine.load('https://example.com/manifest.mpd');

      await new Promise((r) => setTimeout(r, 0));

      expect(mockedGetSDK).toHaveBeenCalled();
      expect(mockDashjs.MediaPlayer).toHaveBeenCalled();
      expect(mockPlayer.create).toHaveBeenCalled();
      expect(mockPlayer.initialize).toHaveBeenCalledWith(video, 'https://example.com/manifest.mpd', false);
    });
  });

  describe('FLV loading', () => {
    it('loads FLV SDK for flv URLs', async () => {
      const mockFlvPlayer = {
        attachMediaElement: jest.fn(),
        on: jest.fn(),
        load: jest.fn(),
        unload: jest.fn(),
        detachMediaElement: jest.fn(),
        destroy: jest.fn(),
      };
      const mockFlvjs: any = {
        createPlayer: jest.fn(() => mockFlvPlayer),
        Events: { ERROR: 'ERROR' },
      };

      mockedGetSDK.mockResolvedValue(mockFlvjs);

      engine = new MediaEngine(video, { flvVersion: '1.6.2' });
      engine.load('https://example.com/video.flv');

      await new Promise((r) => setTimeout(r, 0));

      expect(mockedGetSDK).toHaveBeenCalled();
      expect(mockFlvjs.createPlayer).toHaveBeenCalledWith({ type: 'flv', url: 'https://example.com/video.flv' });
      expect(mockFlvPlayer.attachMediaElement).toHaveBeenCalledWith(video);
      expect(mockFlvPlayer.load).toHaveBeenCalled();
    });
  });

  describe('MediaStream loading', () => {
    it('sets srcObject for MediaStream', () => {
      // Mock MediaStream
      class MockMS {}
      (window as any).MediaStream = MockMS;
      engine = new MediaEngine(video);
      const stream = new MockMS();
      engine.load(stream as any);
      expect(video.srcObject).toBe(stream);
      delete (window as any).MediaStream;
    });
  });

  describe('destroy', () => {
    it('is idempotent', () => {
      engine = new MediaEngine(video);
      engine.destroy();
      engine.destroy(); // second call should not throw
    });

    it('prevents load after destroy', () => {
      engine = new MediaEngine(video);
      engine.destroy();
      engine.load('test.mp4'); // should not throw or set src
    });
  });

  describe('PiP', () => {
    it('enablePiP calls requestPictureInPicture', () => {
      engine = new MediaEngine(video);
      (video as any).requestPictureInPicture = jest.fn().mockResolvedValue(undefined);
      engine.enablePiP();
      expect((video as any).requestPictureInPicture).toHaveBeenCalled();
    });

    it('disablePiP calls exitPictureInPicture when in PiP', () => {
      engine = new MediaEngine(video);
      Object.defineProperty(document, 'pictureInPictureElement', { value: video, configurable: true });
      document.exitPictureInPicture = jest.fn().mockResolvedValue(undefined);
      engine.disablePiP();
      expect(document.exitPictureInPicture).toHaveBeenCalled();
      Object.defineProperty(document, 'pictureInPictureElement', { value: null, configurable: true });
    });
  });

  describe('getHlsInstance / getDashInstance', () => {
    it('returns null when no SDK loaded', () => {
      engine = new MediaEngine(video);
      expect(engine.getHlsInstance()).toBeNull();
      expect(engine.getDashInstance()).toBeNull();
    });
  });
});

describe('MediaEngine - additional branches', () => {
  let video: HTMLVideoElement;
  let engine: MediaEngine;

  beforeEach(() => {
    video = document.createElement('video');
    video.play = jest.fn().mockResolvedValue(undefined);
    video.pause = jest.fn();
    video.load = jest.fn();
    Object.defineProperty(video, 'buffered', {
      get: () => ({ length: 1, start: () => 0, end: () => 30 }),
    });
    mockedGetSDK.mockReset();
  });

  afterEach(() => {
    engine?.destroy();
  });

  it('load with forceDisableHls calls el.load()', () => {
    engine = new MediaEngine(video, { forceDisableHls: true });
    engine.load('video.mp4');
    expect(video.load).toHaveBeenCalled();
  });

  it('DASH loading with version < 3 calls getDebug().setLogToBrowserConsole(false)', async () => {
    const mockDebug = { setLogToBrowserConsole: jest.fn() };
    const mockPlayer = {
      create: jest.fn().mockReturnThis(),
      initialize: jest.fn(),
      on: jest.fn(),
      getDebug: jest.fn(() => mockDebug),
      reset: jest.fn(),
    };
    const mockDashjs: any = {
      MediaPlayer: jest.fn(() => mockPlayer),
    };

    mockedGetSDK.mockResolvedValue(mockDashjs);

    engine = new MediaEngine(video, { dashVersion: '2.9.0' });
    engine.load('https://example.com/manifest.mpd');

    await new Promise((r) => setTimeout(r, 0));

    expect(mockDebug.setLogToBrowserConsole).toHaveBeenCalledWith(false);
  });

  it('HLS loading does not proceed if destroyed before resolve', async () => {
    const MockHls: any = jest.fn();
    MockHls.Events = { MANIFEST_PARSED: 'MP', ERROR: 'E' };
    mockedGetSDK.mockResolvedValue(MockHls);

    engine = new MediaEngine(video);
    engine.load('stream.m3u8');
    engine.destroy();

    await new Promise((r) => setTimeout(r, 0));

    expect(MockHls).not.toHaveBeenCalled();
  });

  it('HLS loading emits error on SDK load failure', async () => {
    mockedGetSDK.mockRejectedValue(new Error('SDK load failed'));

    engine = new MediaEngine(video);
    const errorHandler = jest.fn();
    engine.on('error', errorHandler);
    engine.load('stream.m3u8');

    await new Promise((r) => setTimeout(r, 0));

    expect(errorHandler).toHaveBeenCalled();
  });

  it('FLV loading does not proceed if destroyed before resolve', async () => {
    const mockFlvjs: any = { createPlayer: jest.fn(), Events: { ERROR: 'E' } };
    mockedGetSDK.mockResolvedValue(mockFlvjs);

    engine = new MediaEngine(video);
    engine.load('video.flv');
    engine.destroy();

    await new Promise((r) => setTimeout(r, 0));

    expect(mockFlvjs.createPlayer).not.toHaveBeenCalled();
  });

  it('enablePiP uses webkit fallback', () => {
    engine = new MediaEngine(video);
    (video as any).webkitSupportsPresentationMode = true;
    (video as any).webkitSetPresentationMode = jest.fn();
    (video as any).webkitPresentationMode = 'inline';
    // No requestPictureInPicture
    delete (video as any).requestPictureInPicture;
    engine.enablePiP();
    expect((video as any).webkitSetPresentationMode).toHaveBeenCalledWith('picture-in-picture');
  });

  it('disablePiP uses webkit fallback', () => {
    engine = new MediaEngine(video);
    (video as any).webkitSupportsPresentationMode = true;
    (video as any).webkitSetPresentationMode = jest.fn();
    (video as any).webkitPresentationMode = 'picture-in-picture';
    Object.defineProperty(document, 'pictureInPictureElement', { value: null, configurable: true });
    engine.disablePiP();
    expect((video as any).webkitSetPresentationMode).toHaveBeenCalledWith('inline');
  });

  it('emits enablePiP on enterpictureinpicture event', () => {
    engine = new MediaEngine(video);
    const handler = jest.fn();
    engine.on('enablePiP', handler);
    video.dispatchEvent(new Event('enterpictureinpicture'));
    expect(handler).toHaveBeenCalled();
  });

  it('emits disablePiP on leavepictureinpicture event', () => {
    engine = new MediaEngine(video);
    const handler = jest.fn();
    engine.on('disablePiP', handler);
    video.dispatchEvent(new Event('leavepictureinpicture'));
    expect(handler).toHaveBeenCalled();
  });

  it('forceHLS config triggers HLS loading for any URL', async () => {
    const mockHlsInstance = {
      on: jest.fn(),
      loadSource: jest.fn(),
      attachMedia: jest.fn(),
      destroy: jest.fn(),
    };
    const MockHls: any = jest.fn(() => mockHlsInstance);
    MockHls.Events = { MANIFEST_PARSED: 'MANIFEST_PARSED', ERROR: 'ERROR' };
    mockedGetSDK.mockResolvedValue(MockHls);

    engine = new MediaEngine(video, { forceHLS: true });
    engine.load('video.mp4');

    await new Promise((r) => setTimeout(r, 0));

    expect(MockHls).toHaveBeenCalled();
  });

  it('forceDASH config triggers DASH loading for any URL', async () => {
    const mockPlayer = {
      create: jest.fn().mockReturnThis(),
      initialize: jest.fn(),
      on: jest.fn(),
      updateSettings: jest.fn(),
      reset: jest.fn(),
    };
    const mockDashjs: any = {
      MediaPlayer: jest.fn(() => mockPlayer),
      LogLevel: { LOG_LEVEL_NONE: 0 },
    };
    mockedGetSDK.mockResolvedValue(mockDashjs);

    engine = new MediaEngine(video, { forceDASH: true });
    engine.load('video.mp4');

    await new Promise((r) => setTimeout(r, 0));

    expect(mockDashjs.MediaPlayer).toHaveBeenCalled();
  });

  it('forceFLV config triggers FLV loading for any URL', async () => {
    const mockFlvPlayer = {
      attachMediaElement: jest.fn(),
      on: jest.fn(),
      load: jest.fn(),
      unload: jest.fn(),
      detachMediaElement: jest.fn(),
      destroy: jest.fn(),
    };
    const mockFlvjs: any = {
      createPlayer: jest.fn(() => mockFlvPlayer),
      Events: { ERROR: 'ERROR' },
    };
    mockedGetSDK.mockResolvedValue(mockFlvjs);

    engine = new MediaEngine(video, { forceFLV: true });
    engine.load('video.mp4');

    await new Promise((r) => setTimeout(r, 0));

    expect(mockFlvjs.createPlayer).toHaveBeenCalled();
  });

  it('destroySDKs cleans up all SDK instances', async () => {
    const mockFlvPlayer = {
      attachMediaElement: jest.fn(),
      on: jest.fn(),
      load: jest.fn(),
      unload: jest.fn(),
      detachMediaElement: jest.fn(),
      destroy: jest.fn(),
    };
    const mockFlvjs: any = {
      createPlayer: jest.fn(() => mockFlvPlayer),
      Events: { ERROR: 'ERROR' },
    };
    mockedGetSDK.mockResolvedValue(mockFlvjs);

    engine = new MediaEngine(video, { forceFLV: true });
    engine.load('video.flv');
    await new Promise((r) => setTimeout(r, 0));

    // Load again triggers destroySDKs on previous
    engine.load('other.mp4');
    expect(mockFlvPlayer.unload).toHaveBeenCalled();
    expect(mockFlvPlayer.detachMediaElement).toHaveBeenCalled();
    expect(mockFlvPlayer.destroy).toHaveBeenCalled();
  });
});

describe('MediaEngine - additional uncovered branches', () => {
  let video: HTMLVideoElement;
  let engine: MediaEngine;

  beforeEach(() => {
    video = createMockVideo();
    mockedGetSDK.mockReset();
  });

  afterEach(() => {
    engine?.destroy();
  });

  describe('load with MediaStream srcObject fallback', () => {
    it('uses URL.createObjectURL when srcObject assignment throws', () => {
      engine = new MediaEngine(video);
      const fakeUrl = 'blob:fake';
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue(fakeUrl);

      // MediaStream detection
      (window as any).MediaStream = class {};
      const stream = new (window as any).MediaStream();

      // Force srcObject setter to throw only once for the load call
      let throwCount = 0;
      const originalDescriptor = Object.getOwnPropertyDescriptor(video, 'srcObject') ||
        Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
      Object.defineProperty(video, 'srcObject', {
        set: (val: any) => {
          if (throwCount === 0 && val !== null) {
            throwCount++;
            throw new Error('srcObject not supported');
          }
          // Allow null assignment (stop/destroy)
        },
        get: () => null,
        configurable: true,
      });

      engine.load(stream);
      expect(URL.createObjectURL).toHaveBeenCalledWith(stream);
      expect(video.src).toContain(fakeUrl);

      URL.createObjectURL = origCreateObjectURL;
      delete (window as any).MediaStream;
    });
  });

  describe('shouldUseHLS branches', () => {
    it('loads native when forceDisableHls is set (no HLS SDK used)', () => {
      engine = new MediaEngine(video, { forceDisableHls: true });
      engine.load('video.m3u8');
      // Should use native loading (el.load called) not getSDK
      expect(video.load).toHaveBeenCalled();
      expect(mockedGetSDK).not.toHaveBeenCalled();
    });

    it('forces HLS loading when forceHLS config is set', () => {
      mockedGetSDK.mockResolvedValue({
        Events: { MANIFEST_PARSED: 'parsed', ERROR: 'error' },
        // HLS constructor mock
        prototype: {},
      });
      // Make getSDK return a constructor-like
      const MockHls: any = jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        loadSource: jest.fn(),
        attachMedia: jest.fn(),
        destroy: jest.fn(),
      }));
      MockHls.Events = { MANIFEST_PARSED: 'parsed', ERROR: 'error' };
      mockedGetSDK.mockResolvedValue(MockHls);

      engine = new MediaEngine(video, { forceHLS: true });
      engine.load('video.mp4'); // not HLS extension but forced
      expect(mockedGetSDK).toHaveBeenCalled();
    });
  });

  describe('onPresentationModeChange — non-pip mode', () => {
    it('does not emit when webkitPresentationMode is not pip or inline', () => {
      Object.defineProperty(video, 'webkitSupportsPresentationMode', { value: true, configurable: true });
      Object.defineProperty(video, 'webkitSetPresentationMode', { value: jest.fn(), configurable: true });
      Object.defineProperty(video, 'webkitPresentationMode', { value: 'fullscreen', configurable: true });

      engine = new MediaEngine(video);
      const enableSpy = jest.fn();
      const disableSpy = jest.fn();
      engine.on('enablePiP', enableSpy);
      engine.on('disablePiP', disableSpy);

      video.dispatchEvent(new Event('webkitpresentationmodechanged'));

      expect(enableSpy).not.toHaveBeenCalled();
      expect(disableSpy).not.toHaveBeenCalled();
    });

    it('emits enablePiP when webkitPresentationMode is picture-in-picture', () => {
      Object.defineProperty(video, 'webkitSupportsPresentationMode', { value: true, configurable: true });
      Object.defineProperty(video, 'webkitSetPresentationMode', { value: jest.fn(), configurable: true });
      Object.defineProperty(video, 'webkitPresentationMode', { value: 'picture-in-picture', configurable: true });

      engine = new MediaEngine(video);
      const spy = jest.fn();
      engine.on('enablePiP', spy);

      video.dispatchEvent(new Event('webkitpresentationmodechanged'));
      expect(spy).toHaveBeenCalled();
    });

    it('emits disablePiP when webkitPresentationMode is inline', () => {
      Object.defineProperty(video, 'webkitSupportsPresentationMode', { value: true, configurable: true });
      Object.defineProperty(video, 'webkitSetPresentationMode', { value: jest.fn(), configurable: true });
      Object.defineProperty(video, 'webkitPresentationMode', { value: 'inline', configurable: true });

      engine = new MediaEngine(video);
      const spy = jest.fn();
      engine.on('disablePiP', spy);

      video.dispatchEvent(new Event('webkitpresentationmodechanged'));
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('native loading with iOS flag', () => {
    it('calls el.load() when IS_IOS-like config is present via forceDisableHls', () => {
      engine = new MediaEngine(video, { forceDisableHls: true });
      engine.load('native.mp4');
      expect(video.src).toContain('native.mp4');
      expect(video.load).toHaveBeenCalled();
    });
  });
});
