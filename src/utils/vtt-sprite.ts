/**
 * Sprite VTT parser for thumbnail preview.
 * Parses VTT files containing image sprite coordinates.
 */

export interface VttSpriteCue {
  from: number;
  to: number;
  file: string;
  x: string;
  y: string;
  w: string;
  h: string;
}

/**
 * @deprecated Use `VttSpriteCue` instead. Kept for backward compatibility.
 */
export type SpriteFrame = VttSpriteCue;

/**
 * Convert a timecode string (e.g. "01:23:45" or "01:23:45:12") to seconds.
 */
export function timeCodeToSeconds(timeCode: string): number {
  if (typeof timeCode !== 'string') {
    throw new TypeError('Time must be a string');
  }

  let code = timeCode;
  if (code.indexOf(';') > 0) {
    code = code.replace(';', ':');
    if (!/\d{2}(:\d{2}){0,3}/i.test(code)) {
      throw new TypeError('Time code must have the format `00:00:00`');
    }
  }

  const timeParts = code.split(':');

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let frames = 0;
  const frameRate = 25;
  const roundedFrameRate = Math.round(frameRate);
  const secondsPerHour = 3600 * roundedFrameRate;
  const secondsPerMinute = 60 * roundedFrameRate;

  switch (timeParts.length) {
    default:
    case 1:
      seconds = parseInt(timeParts[0]!, 10);
      break;
    case 2:
      minutes = parseInt(timeParts[0]!, 10);
      seconds = parseInt(timeParts[1]!, 10);
      break;
    case 3:
      hours = parseInt(timeParts[0]!, 10);
      minutes = parseInt(timeParts[1]!, 10);
      seconds = parseInt(timeParts[2]!, 10);
      break;
    case 4:
      hours = parseInt(timeParts[0]!, 10);
      minutes = parseInt(timeParts[1]!, 10);
      seconds = parseInt(timeParts[2]!, 10);
      frames = parseInt(timeParts[3]!, 10);
  }

  const totalSeconds = (secondsPerHour * hours + secondsPerMinute * minutes + frameRate * seconds + frames) / frameRate;
  return parseFloat(totalSeconds.toFixed(3));
}

/**
 * Parse a VTT sprite file into an array of frames with coordinates.
 * Supports both `#xywh=` and `?xywh=` separators.
 */
export function parseSpriteVTT(vttString: string): VttSpriteCue[] {
  let from = 0;
  let to = 0;
  const frames: VttSpriteCue[] = [];

  for (const line of vttString.split('\n')) {
    if (/-->/.test(line)) {
      const match = line.match(/(.*) --> (.*)/);
      if (match) {
        from = timeCodeToSeconds(match[1]!.trim());
        to = timeCodeToSeconds(match[2]!.trim());
      }
    } else if (/\.(png|jpg|jpeg|webp)/i.test(line)) {
      const spriteMatch = line.match(/(.*)[#?]xywh=(.*),(.*),(.*),(.*)/);
      if (spriteMatch) {
        frames.push({
          from,
          to,
          file: spriteMatch[1]!,
          x: spriteMatch[2]!,
          y: spriteMatch[3]!,
          w: spriteMatch[4]!,
          h: spriteMatch[5]!,
        });
      }
    }
  }

  return frames;
}
