import { parseSpriteVTT, timeCodeToSeconds } from '@utils/vtt-sprite';

describe('timeCodeToSeconds', () => {
  test('parses simple seconds', () => {
    expect(timeCodeToSeconds('30')).toBe(30);
  });

  test('parses MM:SS', () => {
    expect(timeCodeToSeconds('01:30')).toBe(90);
  });

  test('parses HH:MM:SS', () => {
    expect(timeCodeToSeconds('01:00:00')).toBe(3600);
    expect(timeCodeToSeconds('00:01:30')).toBe(90);
  });

  test('parses HH:MM:SS:FF (frames)', () => {
    // 1 second + 12 frames at 25fps = 1.48
    expect(timeCodeToSeconds('00:00:01:12')).toBeCloseTo(1.48, 1);
  });

  test('handles semicolons (drop-frame notation)', () => {
    // Only first semicolon is replaced — matches existing implementation
    expect(timeCodeToSeconds('00:01;30')).toBe(90);
  });

  test('throws for non-string input', () => {
    expect(() => timeCodeToSeconds(123 as any)).toThrow('Time must be a string');
  });
});

describe('parseSpriteVTT', () => {
  test('parses basic VTT sprite format', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
sprite.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
sprite.jpg#xywh=160,0,160,90`;

    const result = parseSpriteVTT(vtt);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: 0, to: 5, file: 'sprite.jpg', x: '0', y: '0', w: '160', h: '90' });
    expect(result[1]).toEqual({ from: 5, to: 10, file: 'sprite.jpg', x: '160', y: '0', w: '160', h: '90' });
  });

  test('supports ?xywh= separator', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
sprite.png?xywh=0,0,200,100`;

    const result = parseSpriteVTT(vtt);
    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('sprite.png');
  });

  test('handles webp images', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
thumbs.webp#xywh=0,0,120,68`;

    const result = parseSpriteVTT(vtt);
    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('thumbs.webp');
  });

  test('returns empty array for empty string', () => {
    expect(parseSpriteVTT('')).toEqual([]);
  });

  test('returns empty array for VTT without sprites', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Just some text caption`;
    expect(parseSpriteVTT(vtt)).toEqual([]);
  });
});
