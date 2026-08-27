import fc from 'fast-check';

import { reflectStateToAttributes, readStateFromAttributes } from '@styles/state-attributes';
import type { ReflectableState } from '@typings/styles/state-attributes.types';

/**
 * A state key matches the camelCase<->kebab-case bijection documented in
 * `state-attributes.ts`: `^[a-z][a-zA-Z0-9]*$` (starts with a lowercase letter,
 * then letters/digits, NO hyphens/underscores). Built from primitives so the
 * generator stays robust across fast-check versions: a first char from `[a-z]`
 * followed by any number of chars from `[a-zA-Z0-9]`.
 */
const firstCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''));
const tailCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''));
const keyArb = fc
  .tuple(firstCharArb, fc.array(tailCharArb, { minLength: 0, maxLength: 12 }))
  .map(([first, tail]) => `${first}${tail.join('')}`);

/**
 * A reflectable value of type `string | number | boolean | null`. Numbers are
 * constrained to finite, non-NaN values so the JSON encode/decode roundtrip is
 * exact (JSON turns NaN/Infinity into `null`, which would break the roundtrip).
 * `-0` is excluded because JSON serializes it as `0`, so it would not survive
 * the roundtrip as `-0`.
 */
const valueArb = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0)),
  fc.integer().filter((n) => !Object.is(n, -0)),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generates a `ReflectableState` with unique keys (each matching the documented
 * key space) mapped to reflectable values. `fc.uniqueArray` guarantees no
 * duplicate keys, so the object never loses entries during construction.
 */
const stateArb: fc.Arbitrary<ReflectableState> = fc
  .uniqueArray(fc.tuple(keyArb, valueArb), {
    selector: ([key]) => key,
    maxLength: 12,
  })
  .map((entries) => Object.fromEntries(entries) as ReflectableState);

describe('state-attributes PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 2: Roundtrip estado↔atributo
  it('Property 2: Roundtrip estado↔atributo — readStateFromAttributes(reflectStateToAttributes(state)) === state, without mutating the input', () => {
    // Validates: Requirements 3.3, 13.3, 20.2
    fc.assert(
      fc.property(stateArb, (state) => {
        // Deep clone before reflecting so we can assert non-mutation afterwards.
        // JSON clone is exact here: values are the JSON-safe primitives
        // string/number/boolean/null (the generator excludes NaN/Infinity/-0).
        const clone = JSON.parse(JSON.stringify(state)) as ReflectableState;

        const attributes = reflectStateToAttributes(state);

        // Non-mutation: reflecting must not touch the input object.
        expect(state).toEqual(clone);

        // Roundtrip: reading the attributes back yields the original state.
        expect(readStateFromAttributes(attributes)).toEqual(state);
      }),
      { numRuns: 100 },
    );
  });
});
