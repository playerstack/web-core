/**
 * Parsed VTT cue.
 */
export interface VTTCue {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Caption style options (YouTube-style).
 */
export interface CaptionStyleOptions {
  fontFamily: string;
  fontColor: string;
  fontSize: string;
  fontOpacity: string;
  backgroundColor: string;
  backgroundOpacity: string;
  windowColor: string;
  windowOpacity: string;
  edgeStyle: string;
}
