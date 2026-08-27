import fc from 'fast-check';

import { tokenToCssVarName, cssVarNameToTokenId } from '@styles/token-css';
import type { TokenId } from '@typings/styles/token-css.types';

/**
 * A category never contains a hyphen, so the parser can split the variable body
 * on its FIRST hyphen: everything before is the category, everything after is
 * the name. The four categories mirror `DesignToken['category']`.
 */
const categoryArb = fc.constantFrom<TokenId['category']>('color', 'space', 'font', 'radius');

/**
 * A single `[a-z0-9]+` segment: non-empty lowercase letters/digits. Segments are
 * joined by single hyphens to build a name matching `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`.
 * Built from primitives so it stays robust across fast-check versions.
 */
const segmentArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));

/**
 * Generates a valid token `name`: a first segment that starts with a lowercase
 * LETTER, optionally followed by internal hyphen-separated `[a-z0-9]+` segments.
 * This guarantees the name is non-empty, has no leading/trailing hyphen and no
 * empty segments, so the FIRST-hyphen split stays unambiguous on roundtrip.
 */
const nameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(segmentArb, { minLength: 0, maxLength: 4 }),
  )
  .map(([firstLetter, restSegments]) => [`${firstLetter}`, ...restSegments].join('-'));

const tokenIdArb: fc.Arbitrary<TokenId> = fc.record({ category: categoryArb, name: nameArb });

describe('token-css PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 1: Roundtrip token↔variable
  it('Property 1: Roundtrip token↔variable — cssVarNameToTokenId(tokenToCssVarName(token)) === token, and mapping is deterministic', () => {
    // Validates: Requirements 4.5, 20.1
    fc.assert(
      fc.property(tokenIdArb, (token) => {
        const varName = tokenToCssVarName(token);

        // Roundtrip: parsing the produced variable name yields the original id.
        expect(cssVarNameToTokenId(varName)).toEqual({ category: token.category, name: token.name });

        // Determinism: the same input always yields the same variable name.
        expect(tokenToCssVarName(token)).toBe(varName);
        expect(tokenToCssVarName({ category: token.category, name: token.name })).toBe(varName);
      }),
      { numRuns: 100 },
    );
  });
});
