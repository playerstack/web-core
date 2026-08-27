import { isBlobUrl } from '@utils/media';

describe('media utils', () => {
  describe('isBlobUrl', () => {
    it('returns true for blob URLs', () => {
      expect(isBlobUrl('blob:https://example.com/abc')).toBe(true);
      expect(isBlobUrl('blob:null/123')).toBe(true);
    });

    it('returns false for non-blob URLs', () => {
      expect(isBlobUrl('https://example.com/video.mp4')).toBe(false);
      expect(isBlobUrl('')).toBe(false);
    });
  });
});
