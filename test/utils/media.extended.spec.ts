import { isMediaStream, isBlobUrl, hasAudio, supportsWebKitPresentationMode } from '@utils/media';

// MediaStream not available in jsdom, mock it
class MockMediaStream {}
(global as any).window.MediaStream = MockMediaStream;

describe('isMediaStream', () => {
  it('returns true for MediaStream instance', () => {
    const stream = new MockMediaStream();
    expect(isMediaStream(stream as any)).toBe(true);
  });

  it('returns false for string URL', () => {
    expect(isMediaStream('http://example.com/video.mp4')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isMediaStream(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isMediaStream(undefined)).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isMediaStream({})).toBe(false);
  });
});

describe('isBlobUrl', () => {
  it('returns true for blob URL', () => {
    expect(isBlobUrl('blob:http://localhost/abc-123')).toBe(true);
  });

  it('returns false for http URL', () => {
    expect(isBlobUrl('http://example.com/video.mp4')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBlobUrl('')).toBe(false);
  });
});

describe('hasAudio', () => {
  it('returns true when mozHasAudio is true', () => {
    const video = { mozHasAudio: true } as any;
    expect(hasAudio(video)).toBe(true);
  });

  it('returns true when webkitAudioDecodedByteCount > 0', () => {
    const video = { webkitAudioDecodedByteCount: 1024 } as any;
    expect(hasAudio(video)).toBe(true);
  });

  it('returns true when audioTracks has items', () => {
    const video = { audioTracks: [{ id: 'track1' }] } as any;
    expect(hasAudio(video)).toBe(true);
  });

  it('returns false when no audio indicators exist', () => {
    const video = {} as any;
    expect(hasAudio(video)).toBe(false);
  });

  it('returns false when webkitAudioDecodedByteCount is 0', () => {
    const video = { webkitAudioDecodedByteCount: 0 } as any;
    expect(hasAudio(video)).toBe(false);
  });

  it('returns false when audioTracks is empty array', () => {
    const video = { audioTracks: [] } as any;
    expect(hasAudio(video)).toBe(false);
  });
});

describe('supportsWebKitPresentationMode', () => {
  it('returns falsy for standard video element', () => {
    const video = document.createElement('video');
    expect(supportsWebKitPresentationMode(video)).toBeFalsy();
  });

  it('returns true when webkitSupportsPresentationMode and webkitSetPresentationMode exist (non-iPhone)', () => {
    const video = {
      webkitSupportsPresentationMode: true,
      webkitSetPresentationMode: jest.fn(),
    } as any;
    expect(supportsWebKitPresentationMode(video)).toBe(true);
  });

  it('returns false when on iPhone', () => {
    const video = {
      webkitSupportsPresentationMode: true,
      webkitSetPresentationMode: jest.fn(),
    } as any;
    const originalUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
      configurable: true,
    });
    expect(supportsWebKitPresentationMode(video)).toBe(false);
    if (originalUA) {
      Object.defineProperty(Navigator.prototype, 'userAgent', originalUA);
    }
  });

  it('returns falsy with null parameter', () => {
    expect(supportsWebKitPresentationMode(null)).toBeFalsy();
  });
});
