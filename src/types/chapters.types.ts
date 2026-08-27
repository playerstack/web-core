/**
 * Chapter segment definition.
 */
export interface ChapterInput {
  title: string;
  startTime: number;
}

export interface ChapterSegment {
  title: string;
  startTime: number;
  endTime: number;
  startPercent: number;
  endPercent: number;
}
