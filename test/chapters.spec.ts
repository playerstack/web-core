import { computeChapterSegments, getChapterAtTime, ChapterSegment } from '@chapters';

describe('computeChapterSegments', () => {
  test('returns empty array for null chapters', () => {
    expect(computeChapterSegments(null, 100)).toEqual([]);
  });

  test('returns empty array for undefined chapters', () => {
    expect(computeChapterSegments(undefined, 100)).toEqual([]);
  });

  test('returns empty array for empty chapters', () => {
    expect(computeChapterSegments([], 100)).toEqual([]);
  });

  test('returns empty array when duration is 0', () => {
    expect(computeChapterSegments([{ title: 'A', startTime: 0 }], 0)).toEqual([]);
  });

  test('returns empty array when duration is negative', () => {
    expect(computeChapterSegments([{ title: 'A', startTime: 0 }], -10)).toEqual([]);
  });

  test('computes single chapter spanning full duration', () => {
    const result = computeChapterSegments([{ title: 'Intro', startTime: 0 }], 100);
    expect(result).toEqual([
      { title: 'Intro', startTime: 0, endTime: 100, startPercent: 0, endPercent: 100 },
    ]);
  });

  test('computes multiple chapters with correct boundaries', () => {
    const chapters = [
      { title: 'Intro', startTime: 0 },
      { title: 'Main', startTime: 50 },
      { title: 'Outro', startTime: 80 },
    ];
    const result = computeChapterSegments(chapters, 100);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ title: 'Intro', startTime: 0, endTime: 50, startPercent: 0, endPercent: 50 });
    expect(result[1]).toEqual({ title: 'Main', startTime: 50, endTime: 80, startPercent: 50, endPercent: 80 });
    expect(result[2]).toEqual({ title: 'Outro', startTime: 80, endTime: 100, startPercent: 80, endPercent: 100 });
  });

  test('sorts chapters by startTime', () => {
    const chapters = [
      { title: 'B', startTime: 50 },
      { title: 'A', startTime: 0 },
    ];
    const result = computeChapterSegments(chapters, 100);
    expect(result[0]!.title).toBe('A');
    expect(result[1]!.title).toBe('B');
  });

  test('filters out chapters beyond duration', () => {
    const chapters = [
      { title: 'A', startTime: 0 },
      { title: 'B', startTime: 200 },
    ];
    const result = computeChapterSegments(chapters, 100);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('A');
  });

  test('clamps endTime to duration', () => {
    const chapters = [
      { title: 'A', startTime: 0 },
      { title: 'B', startTime: 90 },
    ];
    const result = computeChapterSegments(chapters, 100);
    expect(result[1]!.endTime).toBe(100);
  });
});

describe('getChapterAtTime', () => {
  const segments: ChapterSegment[] = [
    { title: 'Intro', startTime: 0, endTime: 50, startPercent: 0, endPercent: 50 },
    { title: 'Main', startTime: 50, endTime: 80, startPercent: 50, endPercent: 80 },
    { title: 'Outro', startTime: 80, endTime: 100, startPercent: 80, endPercent: 100 },
  ];

  test('returns null for empty segments', () => {
    expect(getChapterAtTime([], 50)).toBeNull();
  });

  test('returns first chapter at time 0', () => {
    expect(getChapterAtTime(segments, 0)!.title).toBe('Intro');
  });

  test('returns correct chapter for mid-chapter time', () => {
    expect(getChapterAtTime(segments, 25)!.title).toBe('Intro');
    expect(getChapterAtTime(segments, 55)!.title).toBe('Main');
    expect(getChapterAtTime(segments, 90)!.title).toBe('Outro');
  });

  test('returns chapter at exact boundary', () => {
    expect(getChapterAtTime(segments, 50)!.title).toBe('Main');
    expect(getChapterAtTime(segments, 80)!.title).toBe('Outro');
  });

  test('returns first chapter for negative time', () => {
    expect(getChapterAtTime(segments, -5)!.title).toBe('Intro');
  });
});
