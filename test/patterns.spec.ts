import { canPlay, isAudioUrl, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, HLS_EXTENSIONS, DASH_EXTENSIONS, FLV_EXTENSIONS } from '@patterns';

describe('isAudioUrl', () => {
  test('returns true for mp3', () => {
    expect(isAudioUrl('https://example.com/track.mp3')).toBe(true);
  });

  test('returns true for wav', () => {
    expect(isAudioUrl('https://example.com/track.wav')).toBe(true);
  });

  test('returns true for flac', () => {
    expect(isAudioUrl('https://example.com/track.flac')).toBe(true);
  });

  test('returns true for aac', () => {
    expect(isAudioUrl('https://example.com/track.aac')).toBe(true);
  });

  test('returns true for ogg audio', () => {
    expect(isAudioUrl('https://example.com/track.ogg')).toBe(true);
  });

  test('returns true for m4a', () => {
    expect(isAudioUrl('https://example.com/track.m4a')).toBe(true);
  });

  test('returns true for opus', () => {
    expect(isAudioUrl('https://example.com/track.opus')).toBe(true);
  });

  test('returns true for wma', () => {
    expect(isAudioUrl('https://example.com/track.wma')).toBe(true);
  });

  test('returns false for mp4', () => {
    expect(isAudioUrl('https://example.com/video.mp4')).toBe(false);
  });

  test('returns false for m3u8', () => {
    expect(isAudioUrl('https://example.com/stream.m3u8')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isAudioUrl(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isAudioUrl(undefined)).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isAudioUrl('')).toBe(false);
  });

  test('handles query string after extension', () => {
    expect(isAudioUrl('https://example.com/track.mp3?token=abc')).toBe(true);
  });

  test('handles fragment after extension', () => {
    expect(isAudioUrl('https://example.com/track.mp3#t=10,20')).toBe(true);
  });
});

describe('canPlay', () => {
  test('returns true for video extensions', () => {
    expect(canPlay('https://example.com/video.mp4')).toBe(true);
    expect(canPlay('https://example.com/video.webm')).toBe(true);
  });

  test('returns true for audio extensions', () => {
    expect(canPlay('https://example.com/track.mp3')).toBe(true);
  });

  test('returns true for HLS', () => {
    expect(canPlay('https://example.com/stream.m3u8')).toBe(true);
  });

  test('returns true for DASH', () => {
    expect(canPlay('https://example.com/stream.mpd')).toBe(true);
  });

  test('returns true for FLV', () => {
    expect(canPlay('https://example.com/stream.flv')).toBe(true);
  });

  test('returns true when sources provided', () => {
    expect(canPlay(null, [{ src: 'test.mp4' }])).toBe(true);
  });

  test('returns false for null without sources', () => {
    expect(canPlay(null)).toBe(false);
  });

  test('returns false for unsupported extension', () => {
    expect(canPlay('https://example.com/file.txt')).toBe(false);
  });

  test('returns true for blob URL', () => {
    expect(canPlay('blob:https://example.com/abc123')).toBe(true);
  });
});

describe('extension patterns', () => {
  test('VIDEO_EXTENSIONS matches mp4, webm, ogg, mov, m4v', () => {
    expect(VIDEO_EXTENSIONS.test('video.mp4')).toBe(true);
    expect(VIDEO_EXTENSIONS.test('video.webm')).toBe(true);
    expect(VIDEO_EXTENSIONS.test('video.mov')).toBe(true);
    expect(VIDEO_EXTENSIONS.test('video.m4v')).toBe(true);
  });

  test('AUDIO_EXTENSIONS matches audio formats', () => {
    expect(AUDIO_EXTENSIONS.test('track.mp3')).toBe(true);
    expect(AUDIO_EXTENSIONS.test('track.wav')).toBe(true);
    expect(AUDIO_EXTENSIONS.test('track.flac')).toBe(true);
  });

  test('HLS_EXTENSIONS matches m3u8', () => {
    expect(HLS_EXTENSIONS.test('stream.m3u8')).toBe(true);
  });

  test('DASH_EXTENSIONS matches mpd', () => {
    expect(DASH_EXTENSIONS.test('stream.mpd')).toBe(true);
  });

  test('FLV_EXTENSIONS matches flv', () => {
    expect(FLV_EXTENSIONS.test('stream.flv')).toBe(true);
  });
});
