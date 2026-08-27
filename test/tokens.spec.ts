import { DESIGN_TOKENS } from '@styles/tokens';
import type { TokenCategory } from '@typings/styles/tokens.types';

/**
 * All categories the Style_Layer compiles to `--playerstack-<category>-<name>`
 * CSS_Custom_Properties. Kept in sync with the `TokenCategory` union (Req 4.1).
 */
const ALL_CATEGORIES: TokenCategory[] = ['color', 'space', 'font', 'radius'];

describe('DESIGN_TOKENS', () => {
  test('has at least one token', () => {
    expect(DESIGN_TOKENS.length).toBeGreaterThan(0);
  });

  test('covers every TokenCategory with at least one token', () => {
    for (const category of ALL_CATEGORIES) {
      const found = DESIGN_TOKENS.some((token) => token.category === category);
      expect(found).toBe(true);
    }
  });

  test('only uses known TokenCategory values', () => {
    for (const token of DESIGN_TOKENS) {
      expect(ALL_CATEGORIES).toContain(token.category);
    }
  });

  test('has a unique {category, name} pair for every token', () => {
    const ids = DESIGN_TOKENS.map((token) => `${token.category}:${token.name}`);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(DESIGN_TOKENS.length);
  });

  test('every token has a non-empty string name and value', () => {
    for (const token of DESIGN_TOKENS) {
      expect(typeof token.name).toBe('string');
      expect(token.name.length).toBeGreaterThan(0);
      expect(typeof token.value).toBe('string');
      expect(token.value.length).toBeGreaterThan(0);
    }
  });
});
