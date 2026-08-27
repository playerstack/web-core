import fc from 'fast-check';

import { propToAttribute, attributeToProp } from '@ui/attribute-reflect';

/**
 * A `[value, type]` pair whose `value` matches the declared `type`, generated so
 * that the prop<->attribute roundtrip is exact under strict `===`:
 *
 * - `string`: any `fc.string()`; serialization is identity, so it roundtrips.
 * - `number`: FINITE only. The roundtrip goes through `String(n)`/`Number(s)`, and
 *   `Number(String(x)) === x` holds for every finite JS double. NaN/Infinity are
 *   excluded because they fall back to the type default `0`. `-0` is excluded
 *   because `String(-0)` is `'0'` and `Number('0')` is `0`, so `-0` would not
 *   survive the strict `===` roundtrip.
 * - `boolean`: `fc.boolean()`; presence semantics roundtrip `true`/`false` exactly.
 */
const numberArb = fc
  .oneof(fc.integer(), fc.double({ noNaN: true, noDefaultInfinity: true }))
  .filter((n) => !Object.is(n, -0));

const casesArb = fc.oneof(
  fc.string().map((value) => [value, 'string'] as const),
  numberArb.map((value) => [value, 'number'] as const),
  fc.boolean().map((value) => [value, 'boolean'] as const),
);

describe('attribute-reflect PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 4: Roundtrip prop↔atributo del Custom Element
  it('Property 4: Roundtrip prop↔atributo del Custom Element — attributeToProp(propToAttribute(value, type), type) === value', () => {
    // Validates: Requirements 7.2, 20.4
    fc.assert(
      fc.property(casesArb, ([value, type]) => {
        expect(attributeToProp(propToAttribute(value, type), type)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });
});
