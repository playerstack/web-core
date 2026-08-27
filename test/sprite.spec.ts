import { computeSpriteFrame, computeTimelensFrame, SpriteCue } from '@sprite';

describe('computeTimelensFrame', () => {
  const cues: SpriteCue[] = [
    { from: 0, to: 5, x: 0, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
    { from: 5, to: 10, x: 160, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
    { from: 10, to: 15, x: 0, y: 90, w: 180, h: 101, file: 'sprite2.jpg' },
  ];

  test('returns native 1:1 geometry (no scale) for the matched cue', () => {
    const result = computeTimelensFrame(cues, 7.5);
    expect(result).not.toBeNull();
    // Native size = cue's own w/h; bgPos = -x/-y; no container, no scale, no sheet sizes.
    expect(result).toEqual({ file: 'sprite.jpg', w: 160, h: 90, bgPosX: -160, bgPosY: -0 });
  });

  test('uses the matched cue x/y as negative background position', () => {
    const result = computeTimelensFrame(cues, 12);
    expect(result).toEqual({ file: 'sprite2.jpg', w: 180, h: 101, bgPosX: -0, bgPosY: -90 });
  });

  test('matches on inclusive from/to boundaries (first cue wins on overlap)', () => {
    expect(computeTimelensFrame(cues, 0)!.file).toBe('sprite.jpg');
    // seekTime 5 is inclusive-to of the first cue, so the first cue wins by iteration order.
    expect(computeTimelensFrame(cues, 5)!.bgPosX).toBe(-0);
  });

  test('returns null when seekTime is outside all cues or the array is empty', () => {
    expect(computeTimelensFrame(cues, -1)).toBeNull();
    expect(computeTimelensFrame(cues, 20)).toBeNull();
    expect(computeTimelensFrame([], 2)).toBeNull();
  });

  test('returns null for a degenerate cue (zero width or height)', () => {
    expect(computeTimelensFrame([{ from: 0, to: 5, x: 0, y: 0, w: 0, h: 90, file: 's.jpg' }], 2)).toBeNull();
    expect(computeTimelensFrame([{ from: 0, to: 5, x: 0, y: 0, w: 160, h: 0, file: 's.jpg' }], 2)).toBeNull();
  });
});

describe('computeSpriteFrame', () => {
  const cues: SpriteCue[] = [
    { from: 0, to: 5, x: 0, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
    { from: 5, to: 10, x: 160, y: 0, w: 160, h: 90, file: 'sprite.jpg' },
    { from: 10, to: 15, x: 0, y: 90, w: 160, h: 90, file: 'sprite2.jpg' },
  ];

  const sheetSizes: Record<string, { w: number; h: number }> = {
    'sprite.jpg': { w: 640, h: 360 },
    'sprite2.jpg': { w: 320, h: 180 },
  };

  const container = { width: 800, height: 450 };

  describe('match: cue containing seekTime returns correct geometry', () => {
    test('returns frame geometry for seekTime within first cue', () => {
      const result = computeSpriteFrame(cues, 2.5, container, sheetSizes);

      expect(result).not.toBeNull();
      // scale = Math.max(800/160, 450/90) = Math.max(5, 5) = 5
      expect(result!.file).toBe('sprite.jpg');
      expect(result!.scale).toBe(5);
      // bgW = 640 * 5 = 3200, bgH = 360 * 5 = 1800
      expect(result!.bgW).toBe(3200);
      expect(result!.bgH).toBe(1800);
      // bgPosX = -(0 * 5) = -0, bgPosY = -(0 * 5) = -0
      expect(result!.bgPosX).toBe(-0);
      expect(result!.bgPosY).toBe(-0);
      // offsetX = (800 - 160*5) / 2 = 0, offsetY = (450 - 90*5) / 2 = 0
      expect(result!.offsetX).toBe(0);
      expect(result!.offsetY).toBe(0);
    });

    test('returns frame geometry for seekTime within second cue', () => {
      const result = computeSpriteFrame(cues, 7.5, container, sheetSizes);

      expect(result).not.toBeNull();
      expect(result!.file).toBe('sprite.jpg');
      expect(result!.scale).toBe(5);
      expect(result!.bgW).toBe(3200);
      expect(result!.bgH).toBe(1800);
      // bgPosX = -(160 * 5) = -800
      expect(result!.bgPosX).toBe(-800);
      expect(result!.bgPosY).toBe(-0);
      expect(result!.offsetX).toBe(0);
      expect(result!.offsetY).toBe(0);
    });

    test('computes cover-scale with non-uniform aspect ratio', () => {
      // Container wider than frame aspect: scale determined by width
      const wideContainer = { width: 1000, height: 300 };
      const result = computeSpriteFrame(cues, 2.5, wideContainer, sheetSizes);

      expect(result).not.toBeNull();
      // scale = Math.max(1000/160, 300/90) = Math.max(6.25, 3.333) = 6.25
      expect(result!.scale).toBe(6.25);
      expect(result!.bgW).toBe(640 * 6.25); // 4000
      expect(result!.bgH).toBe(360 * 6.25); // 2250
      expect(result!.bgPosX).toBe(-0);
      expect(result!.bgPosY).toBe(-0);
      // offsetX = (1000 - 160*6.25) / 2 = (1000 - 1000) / 2 = 0
      expect(result!.offsetX).toBe(0);
      // offsetY = (300 - 90*6.25) / 2 = (300 - 562.5) / 2 = -131.25
      expect(result!.offsetY).toBe(-131.25);
    });

    test('computes centering offsets with tall container', () => {
      // Container taller than frame aspect: scale determined by height
      const tallContainer = { width: 300, height: 500 };
      const result = computeSpriteFrame(cues, 2.5, tallContainer, sheetSizes);

      expect(result).not.toBeNull();
      // scale = Math.max(300/160, 500/90) = Math.max(1.875, 5.556) = 5.556
      const expectedScale = Math.max(300 / 160, 500 / 90);
      expect(result!.scale).toBeCloseTo(expectedScale);
      // offsetX = (300 - 160*scale) / 2
      const expectedOffsetX = (300 - 160 * expectedScale) / 2;
      expect(result!.offsetX).toBeCloseTo(expectedOffsetX);
      // offsetY = (500 - 90*scale) / 2 = (500 - 500) / 2 = 0
      expect(result!.offsetY).toBeCloseTo(0);
    });
  });

  describe('exact boundary matching', () => {
    test('matches cue when seekTime === cue.from', () => {
      const result = computeSpriteFrame(cues, 0, container, sheetSizes);
      expect(result).not.toBeNull();
      expect(result!.file).toBe('sprite.jpg');
    });

    test('matches cue when seekTime === cue.to', () => {
      const result = computeSpriteFrame(cues, 5, container, sheetSizes);
      expect(result).not.toBeNull();
      // First cue is [0, 5] — seekTime 5 matches it (inclusive)
      expect(result!.file).toBe('sprite.jpg');
      expect(result!.bgPosX).toBe(-0);
    });

    test('matches second cue at its from boundary', () => {
      const result = computeSpriteFrame(cues, 5, container, sheetSizes);
      // seekTime 5 is in [0,5] (first cue, inclusive to) — first cue wins by iteration order
      expect(result).not.toBeNull();
      expect(result!.bgPosX).toBe(-0); // first cue x=0
    });
  });

  describe('no match: seekTime outside all cues returns null', () => {
    test('returns null when seekTime is before all cues', () => {
      const result = computeSpriteFrame(cues, -1, container, sheetSizes);
      expect(result).toBeNull();
    });

    test('returns null when seekTime is after all cues', () => {
      const result = computeSpriteFrame(cues, 20, container, sheetSizes);
      expect(result).toBeNull();
    });

    test('returns null for empty vttArray', () => {
      const result = computeSpriteFrame([], 5, container, sheetSizes);
      expect(result).toBeNull();
    });
  });

  describe('invalid size: sheet not in sheetSizes returns null', () => {
    test('returns null when cue file is not in sheetSizes', () => {
      const result = computeSpriteFrame(cues, 12, container, sheetSizes);
      // cue at 12s has file 'sprite2.jpg' which IS in sheetSizes
      expect(result).not.toBeNull();

      // Now test with missing file
      const missingCue: SpriteCue[] = [{ from: 0, to: 5, x: 0, y: 0, w: 160, h: 90, file: 'missing.jpg' }];
      const result2 = computeSpriteFrame(missingCue, 2, container, sheetSizes);
      expect(result2).toBeNull();
    });

    test('returns null when sheetSizes is empty', () => {
      const result = computeSpriteFrame(cues, 2, container, {});
      expect(result).toBeNull();
    });
  });

  describe('zero container dimensions', () => {
    test('returns null when container width is 0', () => {
      const result = computeSpriteFrame(cues, 2, { width: 0, height: 450 }, sheetSizes);
      expect(result).toBeNull();
    });

    test('returns null when container height is 0', () => {
      const result = computeSpriteFrame(cues, 2, { width: 800, height: 0 }, sheetSizes);
      expect(result).toBeNull();
    });

    test('returns null when both container dimensions are 0', () => {
      const result = computeSpriteFrame(cues, 2, { width: 0, height: 0 }, sheetSizes);
      expect(result).toBeNull();
    });
  });

  describe('zero cue dimensions', () => {
    test('returns null when cue width is 0', () => {
      const zeroCue: SpriteCue[] = [{ from: 0, to: 5, x: 0, y: 0, w: 0, h: 90, file: 'sprite.jpg' }];
      const result = computeSpriteFrame(zeroCue, 2, container, sheetSizes);
      expect(result).toBeNull();
    });

    test('returns null when cue height is 0', () => {
      const zeroCue: SpriteCue[] = [{ from: 0, to: 5, x: 0, y: 0, w: 160, h: 0, file: 'sprite.jpg' }];
      const result = computeSpriteFrame(zeroCue, 2, container, sheetSizes);
      expect(result).toBeNull();
    });
  });

  describe('parity with reactjs SpritePreview inline math', () => {
    test('produces identical values to inline math from SpritePreview', () => {
      // Simulate the exact computation the SpritePreview component does:
      // containerW=800, containerH=450, item={x:160, y:0, w:160, h:90}, sheet={w:640, h:360}
      const containerW = 800;
      const containerH = 450;
      const frameW = 160;
      const frameH = 90;
      const frameX = 160;
      const frameY = 0;
      const sheetW = 640;
      const sheetH = 360;

      // Inline math from SpritePreview:
      const scaleX = containerW / frameW;
      const scaleY = containerH / frameH;
      const expectedScale = Math.max(scaleX, scaleY);
      const expectedBgW = sheetW * expectedScale;
      const expectedBgH = sheetH * expectedScale;
      const expectedBgPosX = -(frameX * expectedScale);
      const expectedBgPosY = -(frameY * expectedScale);
      const scaledFrameW = frameW * expectedScale;
      const scaledFrameH = frameH * expectedScale;
      const expectedOffsetX = (containerW - scaledFrameW) / 2;
      const expectedOffsetY = (containerH - scaledFrameH) / 2;

      // computeSpriteFrame result:
      const result = computeSpriteFrame(
        [{ from: 5, to: 10, x: frameX, y: frameY, w: frameW, h: frameH, file: 'sprite.jpg' }],
        7,
        { width: containerW, height: containerH },
        { 'sprite.jpg': { w: sheetW, h: sheetH } },
      );

      expect(result).not.toBeNull();
      expect(result!.scale).toBe(expectedScale);
      expect(result!.bgW).toBe(expectedBgW);
      expect(result!.bgH).toBe(expectedBgH);
      expect(result!.bgPosX).toBe(expectedBgPosX);
      expect(result!.bgPosY).toBe(expectedBgPosY);
      expect(result!.offsetX).toBe(expectedOffsetX);
      expect(result!.offsetY).toBe(expectedOffsetY);
    });
  });
});
