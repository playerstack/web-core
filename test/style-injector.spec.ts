import { ensurePlayerstackStyles, ensureGlobalTokens } from '@styles/style-injector';
import { compileTokensToCss } from '@styles/token-css';
import { DESIGN_TOKENS } from '@styles/tokens';

/**
 * Example/edge specs for Style_Auto_Injection that complement the idempotence PBT
 * (style-injector.pbt.spec.ts):
 *
 *  - `ensurePlayerstackStyles` injecting the full Style_Layer ONCE into `document.head`
 *    as a single guarded `<style data-playerstack-styles>` element (Req 3.7, 3.8). There
 *    is no Shadow DOM: the sheet is global, not adopted per root.
 *  - `ensureGlobalTokens` injecting the global `:root` tokens block (Req 3.10).
 *  - A deterministic snapshot of `compileTokensToCss(DESIGN_TOKENS)` in both the
 *    default `:root` and `:host` selectors (Req 17.5), locking the compiled CSS.
 */

/** Removes any injected global markers so document state never leaks between tests. */
function clearGlobalStyles(): void {
  document.head.querySelectorAll('style[data-playerstack-styles]').forEach((el) => {
    el.remove();
  });
}

/** Removes any injected global-tokens marker so document state never leaks between tests. */
function clearGlobalTokens(): void {
  document.head.querySelectorAll('style[data-playerstack-tokens]').forEach((el) => {
    el.remove();
  });
}

describe('ensurePlayerstackStyles', () => {
  beforeEach(() => {
    clearGlobalStyles();
  });

  afterAll(() => {
    clearGlobalStyles();
  });

  it('injects a single <style data-playerstack-styles> into document.head carrying the Style_Layer CSS', () => {
    ensurePlayerstackStyles(document);

    const styles = document.head.querySelectorAll('style[data-playerstack-styles]');
    expect(styles).toHaveLength(1);

    const css = styles[0].textContent ?? '';
    // Base Style_Layer rules from playerstack.css are present...
    expect(css).toContain('playerstack-media-controller');
    // ...and the :root token block compiled from the Design_Tokens is appended.
    expect(css).toContain('--playerstack-color-accent');
    expect(css).toContain(':root {');
  });

  it('is idempotent: N calls still yield exactly ONE global <style>', () => {
    ensurePlayerstackStyles(document);
    ensurePlayerstackStyles(document);
    ensurePlayerstackStyles(document);

    expect(document.head.querySelectorAll('style[data-playerstack-styles]')).toHaveLength(1);
  });
});

describe('ensureGlobalTokens', () => {
  beforeEach(() => {
    clearGlobalTokens();
  });

  afterAll(() => {
    clearGlobalTokens();
  });

  it('injects a single :root tokens block into the document head', () => {
    ensureGlobalTokens(document);

    const markers = document.head.querySelectorAll('style[data-playerstack-tokens]');
    expect(markers).toHaveLength(1);

    const css = markers[0].textContent ?? '';
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain('--playerstack-color-accent');
    expect(css).toContain('--playerstack-space-md');
    expect(css).toContain('--playerstack-radius-full');
  });

  it('is idempotent: N calls still yield exactly ONE tokens block', () => {
    ensureGlobalTokens(document);
    ensureGlobalTokens(document);
    ensureGlobalTokens(document);

    expect(document.head.querySelectorAll('style[data-playerstack-tokens]')).toHaveLength(1);
  });
});

describe('compileTokensToCss snapshot', () => {
  it('compiles the default Design_Tokens under :root (locked snapshot)', () => {
    expect(compileTokensToCss(DESIGN_TOKENS)).toMatchSnapshot();
  });

  it('compiles the default Design_Tokens under :host (locked snapshot)', () => {
    expect(compileTokensToCss(DESIGN_TOKENS, ':host')).toMatchSnapshot();
  });
});
