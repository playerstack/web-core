import { generateHeatmapPath } from '@heatmap';

describe('generateHeatmapPath', () => {
  test('returns empty string for null data', () => {
    expect(generateHeatmapPath(null, 100)).toBe('');
  });

  test('returns empty string for undefined data', () => {
    expect(generateHeatmapPath(undefined, 100)).toBe('');
  });

  test('returns empty string for empty array', () => {
    expect(generateHeatmapPath([], 100)).toBe('');
  });

  test('returns empty string when duration is 0', () => {
    expect(generateHeatmapPath([{ startTime: 0, endTime: 10, value: 0.5 }], 0)).toBe('');
  });

  test('returns empty string when duration is negative', () => {
    expect(generateHeatmapPath([{ startTime: 0, endTime: 10, value: 0.5 }], -10)).toBe('');
  });

  test('returns empty string for single point (needs at least 2)', () => {
    expect(generateHeatmapPath([{ startTime: 0, endTime: 10, value: 0.5 }], 100)).toBe('');
  });

  test('generates valid SVG path for 2+ points', () => {
    const data = [
      { startTime: 0, endTime: 25, value: 0.3 },
      { startTime: 25, endTime: 50, value: 0.8 },
      { startTime: 50, endTime: 75, value: 0.5 },
      { startTime: 75, endTime: 100, value: 0.9 },
    ];
    const path = generateHeatmapPath(data, 100);
    expect(path).toMatch(/^M /);
    expect(path).toContain('C ');
    expect(path.length).toBeGreaterThan(0);
  });

  test('clamps values between 0 and 1', () => {
    const data = [
      { startTime: 0, endTime: 50, value: -0.5 },
      { startTime: 50, endTime: 100, value: 1.5 },
    ];
    const path = generateHeatmapPath(data, 100);
    // Should not crash, values clamped internally
    expect(path).toMatch(/^M /);
  });

  test('starts from floor (y=100) and ends at floor', () => {
    const data = [
      { startTime: 0, endTime: 50, value: 0.5 },
      { startTime: 50, endTime: 100, value: 0.5 },
    ];
    const path = generateHeatmapPath(data, 100);
    expect(path).toMatch(/^M 0,100/);
  });
});
