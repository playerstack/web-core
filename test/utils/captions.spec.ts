import {
  parseVTTCaptions,
  getActiveCues,
  hexToRgba,
  getEdgeStyleCSS,
  DEFAULT_CAPTION_STYLE,
  CAPTION_STYLE_OPTIONS,
} from '@utils/captions';

describe('parseVTTCaptions', () => {
  it('parses a standard VTT string with multiple cues', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.500
Second line`;

    const cues = parseVTTCaptions(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ startTime: 1, endTime: 4, text: 'Hello world' });
    expect(cues[1]).toEqual({ startTime: 5, endTime: 8.5, text: 'Second line' });
  });

  it('handles HH:MM:SS.mmm format', () => {
    const vtt = `WEBVTT

01:02:03.456 --> 01:05:10.000
Long video cue`;

    const cues = parseVTTCaptions(vtt);
    expect(cues[0]!.startTime).toBeCloseTo(3723.456);
    expect(cues[0]!.endTime).toBeCloseTo(3910);
  });

  it('handles multiline cue text', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Line one
Line two
Line three`;

    const cues = parseVTTCaptions(vtt);
    expect(cues[0]!.text).toBe('Line one\nLine two\nLine three');
  });

  it('handles position metadata after timestamp', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000 position:10% align:start
Positioned cue`;

    const cues = parseVTTCaptions(vtt);
    expect(cues[0]!.endTime).toBe(4);
    expect(cues[0]!.text).toBe('Positioned cue');
  });

  it('returns empty array for empty string', () => {
    expect(parseVTTCaptions('')).toEqual([]);
  });

  it('returns empty array for VTT header only', () => {
    expect(parseVTTCaptions('WEBVTT\n\n')).toEqual([]);
  });

  it('skips cue number lines (numeric identifiers)', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
First

2
00:00:05.000 --> 00:00:08.000
Second`;

    const cues = parseVTTCaptions(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.text).toBe('First');
    expect(cues[1]!.text).toBe('Second');
  });

  it('handles MM:SS format (2 parts)', () => {
    const vtt = `WEBVTT

01:30.000 --> 02:00.000
Short format`;

    const cues = parseVTTCaptions(vtt);
    expect(cues[0]!.startTime).toBe(90);
    expect(cues[0]!.endTime).toBe(120);
  });
});

describe('getActiveCues', () => {
  const cues = [
    { startTime: 0, endTime: 5, text: 'First' },
    { startTime: 3, endTime: 8, text: 'Second' },
    { startTime: 10, endTime: 15, text: 'Third' },
  ];

  it('returns cues active at given time', () => {
    expect(getActiveCues(cues, 4)).toEqual([
      { startTime: 0, endTime: 5, text: 'First' },
      { startTime: 3, endTime: 8, text: 'Second' },
    ]);
  });

  it('returns empty array when no cues at time', () => {
    expect(getActiveCues(cues, 9)).toEqual([]);
  });

  it('includes cue at exact startTime boundary', () => {
    expect(getActiveCues(cues, 10)).toEqual([{ startTime: 10, endTime: 15, text: 'Third' }]);
  });

  it('includes cue at exact endTime boundary', () => {
    expect(getActiveCues(cues, 5)).toEqual([
      { startTime: 0, endTime: 5, text: 'First' },
      { startTime: 3, endTime: 8, text: 'Second' },
    ]);
  });

  it('returns empty for empty cues array', () => {
    expect(getActiveCues([], 5)).toEqual([]);
  });
});

describe('hexToRgba', () => {
  it('converts white with 100% opacity', () => {
    expect(hexToRgba('#ffffff', '100%')).toBe('rgba(255, 255, 255, 1)');
  });

  it('converts black with 75% opacity', () => {
    expect(hexToRgba('#000000', '75%')).toBe('rgba(0, 0, 0, 0.75)');
  });

  it('converts red with 50% opacity', () => {
    expect(hexToRgba('#ff0000', '50%')).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('converts with 0% opacity', () => {
    expect(hexToRgba('#00ff00', '0%')).toBe('rgba(0, 255, 0, 0)');
  });

  it('converts arbitrary hex color', () => {
    expect(hexToRgba('#1a2b3c', '25%')).toBe('rgba(26, 43, 60, 0.25)');
  });
});

describe('getEdgeStyleCSS', () => {
  it('returns dropshadow style', () => {
    const result = getEdgeStyleCSS('dropshadow', '#000');
    expect(result).toContain('2px 2px 3px #000');
  });

  it('returns raised style', () => {
    const result = getEdgeStyleCSS('raised', '#000');
    expect(result).toContain('1px 1px 0 #000');
  });

  it('returns depressed style', () => {
    const result = getEdgeStyleCSS('depressed', '#fff');
    expect(result).toContain('-1px -1px 0 #fff');
  });

  it('returns uniform style', () => {
    const result = getEdgeStyleCSS('uniform', 'red');
    expect(result).toContain('0 0 3px red');
  });

  it('returns none for unknown style', () => {
    expect(getEdgeStyleCSS('none', '#000')).toBe('none');
  });

  it('returns none for empty string style', () => {
    expect(getEdgeStyleCSS('', '#000')).toBe('none');
  });
});

describe('DEFAULT_CAPTION_STYLE', () => {
  it('has all required keys', () => {
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('fontFamily', 'sans-serif');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('fontColor', '#ffffff');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('fontSize', '100%');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('fontOpacity', '100%');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('backgroundColor', '#000000');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('backgroundOpacity', '75%');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('windowColor', '#000000');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('windowOpacity', '0%');
    expect(DEFAULT_CAPTION_STYLE).toHaveProperty('edgeStyle', 'none');
  });
});

describe('CAPTION_STYLE_OPTIONS', () => {
  it('has all categories', () => {
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('fontFamily');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('fontColor');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('fontSize');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('fontOpacity');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('backgroundColor');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('backgroundOpacity');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('windowColor');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('windowOpacity');
    expect(CAPTION_STYLE_OPTIONS).toHaveProperty('edgeStyle');
  });

  it('each category has at least one option with label and value', () => {
    Object.values(CAPTION_STYLE_OPTIONS).forEach((options) => {
      expect(options.length).toBeGreaterThan(0);
      options.forEach((option: any) => {
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('value');
      });
    });
  });
});
