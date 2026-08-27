import { tokenToCssVarName, cssVarNameToTokenId, compileTokensToCss } from '@styles/token-css';
import type { DesignTokenSet } from '@typings/styles/tokens.types';

/**
 * Example/edge specs for the pure token<->CSS helpers. These complement the
 * roundtrip PBT (token-css.pbt.spec.ts) with concrete examples, the default vs
 * custom `compileTokensToCss` selector, hyphenated names, and the descriptive
 * errors thrown for malformed variable names (Req 13.2, 17.5).
 */
describe('tokenToCssVarName', () => {
  test('builds the --playerstack-<category>-<name> variable name', () => {
    expect(tokenToCssVarName({ category: 'color', name: 'accent' })).toBe('--playerstack-color-accent');
  });

  test('preserves internal hyphens in the name segment', () => {
    expect(tokenToCssVarName({ category: 'font', name: 'family-base' })).toBe('--playerstack-font-family-base');
    expect(tokenToCssVarName({ category: 'color', name: 'track-buffered' })).toBe('--playerstack-color-track-buffered');
  });
});

describe('cssVarNameToTokenId', () => {
  test('parses a simple variable name back into its token id', () => {
    expect(cssVarNameToTokenId('--playerstack-color-accent')).toEqual({ category: 'color', name: 'accent' });
  });

  test('keeps the whole hyphenated tail as the name (splits on FIRST hyphen only)', () => {
    expect(cssVarNameToTokenId('--playerstack-font-family-base')).toEqual({ category: 'font', name: 'family-base' });
    expect(cssVarNameToTokenId('--playerstack-color-track-buffered')).toEqual({
      category: 'color',
      name: 'track-buffered',
    });
  });

  describe('throws a descriptive Error for invalid names', () => {
    test('throws when the prefix is missing', () => {
      expect(() => cssVarNameToTokenId('--color-accent')).toThrow(/start with "--playerstack-"/);
    });

    test('throws for the empty string', () => {
      expect(() => cssVarNameToTokenId('')).toThrow(/start with "--playerstack-"/);
    });

    test('throws when there is no category/name separator (only a category-like segment)', () => {
      expect(() => cssVarNameToTokenId('--playerstack-color')).toThrow(/<category>-<name>/);
    });

    test('throws for the bare prefix with no category/name segment', () => {
      expect(() => cssVarNameToTokenId('--playerstack-')).toThrow(/<category>-<name>/);
    });

    test('throws when the category segment is empty (leading hyphen after prefix)', () => {
      expect(() => cssVarNameToTokenId('--playerstack--accent')).toThrow(/<category>-<name>/);
    });

    test('throws when the name segment is empty (trailing hyphen)', () => {
      expect(() => cssVarNameToTokenId('--playerstack-color-')).toThrow(/<category>-<name>/);
    });
  });
});

describe('compileTokensToCss', () => {
  const tokens: DesignTokenSet = [
    { category: 'color', name: 'accent', value: '#ff375f' },
    { category: 'space', name: 'md', value: '12px' },
    { category: 'font', name: 'family-base', value: 'sans-serif' },
  ];

  test('wraps the declarations in the default :root selector', () => {
    const css = compileTokensToCss(tokens);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain(':root {');
  });

  test('emits one --playerstack-...: value; declaration line per token', () => {
    const css = compileTokensToCss(tokens);
    expect(css).toContain('--playerstack-color-accent: #ff375f;');
    expect(css).toContain('--playerstack-space-md: 12px;');
    expect(css).toContain('--playerstack-font-family-base: sans-serif;');
  });

  test('uses a custom selector when provided (e.g. :host)', () => {
    const css = compileTokensToCss(tokens, ':host');
    expect(css.startsWith(':host {')).toBe(true);
    expect(css).not.toContain(':root {');
    expect(css).toContain('--playerstack-color-accent: #ff375f;');
  });

  test('preserves token declaration order and is deterministic', () => {
    expect(compileTokensToCss(tokens)).toBe(compileTokensToCss(tokens));
    const css = compileTokensToCss(tokens);
    const accentIndex = css.indexOf('--playerstack-color-accent');
    const spaceIndex = css.indexOf('--playerstack-space-md');
    expect(accentIndex).toBeLessThan(spaceIndex);
  });

  test('emits an empty declaration body for an empty token set', () => {
    expect(compileTokensToCss([])).toBe(':root {\n\n}\n');
  });
});

describe('roundtrip examples', () => {
  const examples: DesignTokenSet = [
    { category: 'color', name: 'accent', value: '#ff375f' },
    { category: 'font', name: 'family-base', value: 'sans-serif' },
    { category: 'color', name: 'track-buffered', value: 'rgba(255, 255, 255, 0.45)' },
  ];

  test('cssVarNameToTokenId inverts tokenToCssVarName for hyphenated names', () => {
    for (const token of examples) {
      const varName = tokenToCssVarName({ category: token.category, name: token.name });
      expect(cssVarNameToTokenId(varName)).toEqual({ category: token.category, name: token.name });
    }
  });
});
