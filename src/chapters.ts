import type { ChapterInput, ChapterSegment } from '@typings/chapters.types';

export type { ChapterInput, ChapterSegment } from '@typings/chapters.types';

/**
 * Compute chapter segments from raw chapter definitions and total duration.
 * Pure function — no framework dependency.
 *
 * @param chapters - Array of chapter definitions (title + startTime)
 * @param duration - Total media duration in seconds
 * @returns Array of computed segments with percentages
 */
export function computeChapterSegments(
  chapters: ChapterInput[] | null | undefined,
  duration: number,
): ChapterSegment[] {
  if (!chapters || chapters.length === 0 || duration <= 0) {
    return [];
  }

  const sorted = [...chapters].filter((c) => c.startTime < duration).sort((a, b) => a.startTime - b.startTime);

  return sorted.map((chapter, index) => {
    const rawEnd = index < sorted.length - 1 ? sorted[index + 1]!.startTime : duration;
    const endTime = Math.min(rawEnd, duration);
    return {
      title: chapter.title,
      startTime: chapter.startTime,
      endTime,
      startPercent: (chapter.startTime / duration) * 100,
      endPercent: (endTime / duration) * 100,
    };
  });
}

/**
 * Find the chapter active at a given time.
 *
 * @param segments - Pre-computed chapter segments
 * @param time - Current time in seconds
 * @returns The active segment or null
 */
export function getChapterAtTime(segments: ChapterSegment[], time: number): ChapterSegment | null {
  if (segments.length === 0) return null;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (time >= segments[i]!.startTime) {
      return segments[i]!;
    }
  }
  return segments[0] ?? null;
}
