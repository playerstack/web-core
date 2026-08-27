import type { VTTCue, CaptionStyleOptions } from '@typings/utils/captions.types';

export type { VTTCue, CaptionStyleOptions } from '@typings/utils/captions.types';

/**
 * Default caption style options.
 */
export const DEFAULT_CAPTION_STYLE: CaptionStyleOptions = {
  fontFamily: 'sans-serif',
  fontColor: '#ffffff',
  fontSize: '100%',
  fontOpacity: '100%',
  backgroundColor: '#000000',
  backgroundOpacity: '75%',
  windowColor: '#000000',
  windowOpacity: '0%',
  edgeStyle: 'none',
};

/**
 * Available options for each caption style property.
 */
export const CAPTION_STYLE_OPTIONS = {
  fontFamily: [
    { label: 'Proportional Sans-Serif', value: 'sans-serif' },
    { label: 'Monospace Sans-Serif', value: 'monospace' },
    { label: 'Proportional Serif', value: 'serif' },
    { label: 'Monospace Serif', value: '"Courier New", monospace' },
    { label: 'Casual', value: '"Comic Sans MS", cursive' },
    { label: 'Cursive', value: '"Brush Script MT", cursive' },
    { label: 'Small Capitals', value: 'small-caps' },
  ],
  fontColor: [
    { label: 'White', value: '#ffffff' },
    { label: 'Yellow', value: '#ffff00' },
    { label: 'Green', value: '#00ff00' },
    { label: 'Cyan', value: '#00ffff' },
    { label: 'Blue', value: '#0000ff' },
    { label: 'Magenta', value: '#ff00ff' },
    { label: 'Red', value: '#ff0000' },
    { label: 'Black', value: '#000000' },
  ],
  fontSize: [
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
    { label: '150%', value: '150%' },
    { label: '200%', value: '200%' },
    { label: '300%', value: '300%' },
    { label: '400%', value: '400%' },
  ],
  fontOpacity: [
    { label: '25%', value: '25%' },
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
  ],
  backgroundColor: [
    { label: 'Black', value: '#000000' },
    { label: 'White', value: '#ffffff' },
    { label: 'Yellow', value: '#ffff00' },
    { label: 'Green', value: '#00ff00' },
    { label: 'Cyan', value: '#00ffff' },
    { label: 'Blue', value: '#0000ff' },
    { label: 'Magenta', value: '#ff00ff' },
    { label: 'Red', value: '#ff0000' },
  ],
  backgroundOpacity: [
    { label: '0%', value: '0%' },
    { label: '25%', value: '25%' },
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
  ],
  windowColor: [
    { label: 'Black', value: '#000000' },
    { label: 'White', value: '#ffffff' },
    { label: 'Red', value: '#ff0000' },
    { label: 'Green', value: '#00ff00' },
    { label: 'Blue', value: '#0000ff' },
    { label: 'Yellow', value: '#ffff00' },
    { label: 'Magenta', value: '#ff00ff' },
    { label: 'Cyan', value: '#00ffff' },
  ],
  windowOpacity: [
    { label: '0%', value: '0%' },
    { label: '25%', value: '25%' },
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
  ],
  edgeStyle: [
    { label: 'None', value: 'none' },
    { label: 'Drop Shadow', value: 'dropshadow' },
    { label: 'Raised', value: 'raised' },
    { label: 'Depressed', value: 'depressed' },
    { label: 'Uniform', value: 'uniform' },
  ],
};

/**
 * Parse time string (HH:MM:SS.mmm or MM:SS.mmm) to seconds.
 */
function parseTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h!) * 3600 + parseFloat(m!) * 60 + parseFloat(s!);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m!) * 60 + parseFloat(s!);
  }
  return 0;
}

/**
 * Parse a VTT string into an array of cues.
 * Framework-agnostic — works in any JS runtime.
 */
export function parseVTTCaptions(vttString: string): VTTCue[] {
  const cues: VTTCue[] = [];
  const lines = vttString.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!.trim();

    // Look for timestamp line (contains " --> ")
    if (line.includes(' --> ')) {
      const [startStr, endStr] = line.split(' --> ');
      const startTime = parseTime(startStr!);
      const endTime = parseTime(endStr!.split(' ')[0]!); // Remove position metadata after time

      // Collect text lines until empty line or end
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i]!.trim() !== '') {
        textLines.push(lines[i]!.trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          startTime,
          endTime,
          text: textLines.join('\n'),
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}

/**
 * Get active cues for a given time.
 */
export function getActiveCues(cues: VTTCue[], currentTime: number): VTTCue[] {
  return cues.filter((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime);
}

/**
 * Convert hex color + opacity percentage to rgba string.
 */
export function hexToRgba(hex: string, opacity: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = parseInt(opacity) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Build CSS text-shadow for caption edge styles.
 */
export function getEdgeStyleCSS(style: string, color: string): string {
  switch (style) {
    case 'dropshadow':
      return `2px 2px 3px ${color}, 2px 2px 4px ${color}`;
    case 'raised':
      return `1px 1px 0 ${color}, 2px 2px 0 ${color}`;
    case 'depressed':
      return `-1px -1px 0 ${color}, -2px -2px 0 ${color}`;
    case 'uniform':
      return `0 0 3px ${color}, 0 0 3px ${color}, 0 0 3px ${color}, 0 0 3px ${color}`;
    default:
      return 'none';
  }
}
