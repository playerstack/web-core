import fc from 'fast-check';

import { ensurePlayerstackStyles, ensureGlobalTokens } from '@styles/style-injector';

/**
 * Property 6: Idempotencia de Style_Auto_Injection.
 *
 * In the light-DOM model there is NO Shadow DOM and NO per-root adopted stylesheet: the
 * full Style_Layer is injected ONCE into `document.head` as a single guarded
 * `<style data-playerstack-styles>` element, and the global `:root` tokens block is
 * injected ONCE as a `<style data-playerstack-tokens>` element. This property asserts
 * that no matter how many times the injectors run, each global marker appears EXACTLY
 * once (Req 3.7, 3.8, 3.10, 20.6).
 */

/** Removes the global Style_Layer marker so state never leaks between property runs. */
function clearGlobalStyles(): void {
  document.head.querySelectorAll('style[data-playerstack-styles]').forEach((el) => {
    el.remove();
  });
}

/** Removes the global-tokens marker so state never leaks between property runs. */
function clearGlobalTokens(): void {
  document.head.querySelectorAll('style[data-playerstack-tokens]').forEach((el) => {
    el.remove();
  });
}

describe('style-injector Style_Auto_Injection PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 6: Idempotencia de Style_Auto_Injection
  it('Property 6: Idempotencia de Style_Auto_Injection — the global Style_Layer and tokens are each injected exactly once across N calls', () => {
    // Validates: Requirements 3.7, 3.8, 3.10, 20.6
    fc.assert(
      fc.property(
        // N >= 1 repeated calls.
        fc.integer({ min: 1, max: 20 }),
        (calls) => {
          // Start clean so prior iterations never leak.
          clearGlobalStyles();
          clearGlobalTokens();

          for (let i = 0; i < calls; i += 1) {
            ensurePlayerstackStyles(document);
            ensureGlobalTokens(document);
          }

          // Idempotence: exactly ONE global Style_Layer marker regardless of N calls.
          expect(document.head.querySelectorAll('style[data-playerstack-styles]')).toHaveLength(1);
          // Idempotence: exactly ONE global tokens marker regardless of N calls.
          expect(document.head.querySelectorAll('style[data-playerstack-tokens]')).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  afterAll(() => {
    clearGlobalStyles();
    clearGlobalTokens();
  });
});
