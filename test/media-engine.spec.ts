import { MediaEngine } from '@media-engine';

describe('MediaEngine', () => {
  let video: HTMLVideoElement;
  let engine: MediaEngine;

  beforeEach(() => {
    video = document.createElement('video');
    // Mock play() to return a resolved promise
    video.play = jest.fn().mockResolvedValue(undefined);
    engine = new MediaEngine(video);
  });

  afterEach(() => {
    engine.destroy();
  });

  it('creates engine with a video element', () => {
    expect(engine.getElement()).toBe(video);
  });

  it('play() calls video.play()', () => {
    engine.play();
    expect(video.play).toHaveBeenCalled();
  });

  it('emits "autoplayBlocked" (not "error") when play() is rejected by the autoplay policy', async () => {
    const err = new DOMException('blocked', 'NotAllowedError');
    video.play = jest.fn().mockRejectedValue(err);
    const blocked = jest.fn();
    const errored = jest.fn();
    engine.on('autoplayBlocked', blocked);
    engine.on('error', errored);

    await engine.play();

    expect(blocked).toHaveBeenCalledTimes(1);
    expect(errored).not.toHaveBeenCalled();
  });

  it('ignores an AbortError from play() (transient) without emitting error or autoplayBlocked', async () => {
    video.play = jest.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const blocked = jest.fn();
    const errored = jest.fn();
    engine.on('autoplayBlocked', blocked);
    engine.on('error', errored);

    await engine.play();

    expect(blocked).not.toHaveBeenCalled();
    expect(errored).not.toHaveBeenCalled();
  });

  it('emits "error" for a genuine play() rejection (not autoplay/abort)', async () => {
    video.play = jest.fn().mockRejectedValue(new DOMException('boom', 'NotSupportedError'));
    const errored = jest.fn();
    engine.on('error', errored);

    await engine.play();

    expect(errored).toHaveBeenCalledTimes(1);
  });

  it('pause() calls video.pause()', () => {
    video.pause = jest.fn();
    engine.pause();
    expect(video.pause).toHaveBeenCalled();
  });

  it('setVolume() clamps between 0 and 1', () => {
    engine.setVolume(0.5);
    expect(video.volume).toBe(0.5);

    engine.setVolume(2);
    expect(video.volume).toBe(1);

    engine.setVolume(-1);
    expect(video.volume).toBe(0);
  });

  it('mute/unmute toggle muted state', () => {
    engine.mute();
    expect(video.muted).toBe(true);
    engine.unmute();
    expect(video.muted).toBe(false);
  });

  it('setPlaybackRate changes playback rate', () => {
    engine.setPlaybackRate(2);
    expect(video.playbackRate).toBe(2);
  });

  it('setLoop changes loop property', () => {
    engine.setLoop(true);
    expect(video.loop).toBe(true);
    engine.setLoop(false);
    expect(video.loop).toBe(false);
  });

  it('getState() returns state snapshot', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('playing');
    expect(state).toHaveProperty('paused');
    expect(state).toHaveProperty('volume');
    expect(state).toHaveProperty('muted');
    expect(state).toHaveProperty('playbackRate');
    expect(state).toHaveProperty('loop');
  });

  it('emits events from video element', () => {
    const handler = jest.fn();
    engine.on('pause', handler);
    video.dispatchEvent(new Event('pause'));
    expect(handler).toHaveBeenCalled();
  });

  it('stop() removes src attribute', () => {
    video.src = 'test.mp4';
    engine.stop();
    expect(video.getAttribute('src')).toBeNull();
  });

  it('destroy() prevents further operations', () => {
    engine.destroy();
    // Should not throw after destroy
    expect(() => engine.play()).not.toThrow();
  });

  it('hasEnded() reflects the element ended state', () => {
    Object.defineProperty(video, 'ended', { configurable: true, value: false });
    expect(engine.hasEnded()).toBe(false);
    Object.defineProperty(video, 'ended', { configurable: true, value: true });
    expect(engine.hasEnded()).toBe(true);
  });

  describe('live→VOD detection (liveEnded)', () => {
    const setDuration = (value: number) =>
      Object.defineProperty(video, 'duration', { configurable: true, value });

    it('emits liveEnded when duration flips from Infinity to finite', () => {
      const handler = jest.fn();
      engine.on('liveEnded', handler);

      // Live: infinite duration observed first.
      setDuration(Infinity);
      video.dispatchEvent(new Event('durationchange'));
      expect(handler).not.toHaveBeenCalled();

      // Playlist gained an end boundary → finite duration.
      setDuration(120);
      video.dispatchEvent(new Event('durationchange'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits liveEnded only once', () => {
      const handler = jest.fn();
      engine.on('liveEnded', handler);
      setDuration(Infinity);
      video.dispatchEvent(new Event('durationchange'));
      setDuration(120);
      video.dispatchEvent(new Event('durationchange'));
      setDuration(130);
      video.dispatchEvent(new Event('durationchange'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not emit liveEnded for a plain VOD asset (never infinite)', () => {
      const handler = jest.fn();
      engine.on('liveEnded', handler);
      setDuration(120);
      video.dispatchEvent(new Event('durationchange'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('load() sets video src for native formats', () => {
    engine.load('video.mp4');
    expect(video.src).toContain('video.mp4');
  });
});
