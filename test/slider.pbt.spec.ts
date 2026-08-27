import fc from 'fast-check';

import { getTimeFromSliderPosition } from '@slider';

/**
 * Inverse of `getTimeFromSliderPosition` for the interior of the track: maps a
 * time back to the offset (in px) within the track of the given rect/duration.
 * There is no explicit time->position export in `slider.ts`, so the inverse is
 * defined locally for the roundtrip property.
 */
function positionFromTime(time: number, rect: { left: number; width: number }, duration: number): number {
  return (time / duration) * rect.width;
}

/**
 * Generator for `{ width, left, duration, w }` where `w` is the pointer offset
 * within the track, constrained to `[0, width]`. `width` is bound first so `w`
 * can be sampled within its range.
 */
const sliderArb = fc
  .record({
    width: fc.integer({ min: 1, max: 4000 }),
    left: fc.integer({ min: 0, max: 2000 }),
    duration: fc.double({ min: 0.001, max: 100000, noNaN: true, noDefaultInfinity: true }),
  })
  .chain(({ width, left, duration }) =>
    fc.double({ min: 0, max: 1, noNaN: true }).map((f) => ({
      width,
      left,
      duration,
      w: f * width,
    })),
  );

describe('slider PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 3: Roundtrip posición↔tiempo del slider
  it('Property 3: Roundtrip posición↔tiempo del slider — position→time→position within tolerance', () => {
    // Validates: Requirements 20.3
    fc.assert(
      fc.property(sliderArb, ({ width, left, duration, w }) => {
        const clientX = left + w;
        const time = getTimeFromSliderPosition(clientX, { left, width }, duration);
        const w2 = positionFromTime(time, { left, width }, duration);

        // The clamped input offset (interior generator already keeps w in [0, width]).
        const clampedW = Math.min(width, Math.max(0, w));

        // `getTimeFromSliderPosition` quantizes the interior time via Math.round,
        // so the maximum time error is 0.5. Converting that back to a position
        // scales by (width / duration), bounding the roundtrip position error at
        // (width / duration) * 0.5, plus a tiny epsilon for float arithmetic.
        const tolerance = (width / duration) * 0.5 + 1e-6;

        expect(Math.abs(w2 - clampedW)).toBeLessThanOrEqual(tolerance);
      }),
      { numRuns: 100 },
    );
  });
});
