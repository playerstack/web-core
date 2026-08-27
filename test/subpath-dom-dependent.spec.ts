/**
 * Smoke test: documents that DOM-dependent subpaths rely on browser globals.
 *
 * These tests run in the 'main' project (jsdom environment) and verify that
 * the modules reference browser APIs at load time. This is documentation of
 * expected behavior, not a runtime guard — native packages must never import
 * these subpaths.
 *
 * DOM-dependent subpaths:
 * - ./constants (evaluates navigator/window at load)
 * - ./utils/device (evaluates window/navigator at load)
 */
describe('DOM-dependent subpath behavior', () => {
  it('./constants loads successfully in jsdom (needs browser globals)', async () => {
    // In jsdom, window and navigator are available, so this should work
    const mod = await import('../src/constants');
    expect(mod).toBeDefined();
    // Verify it exports browser-detected values
    expect(typeof mod.IS_IOS).toBe('boolean');
    expect(typeof mod.IS_SAFARI).toBe('boolean');
  });

  it('./utils/device loads successfully in jsdom (needs browser globals)', async () => {
    const mod = await import('../src/utils/device');
    expect(mod).toBeDefined();
    expect(typeof mod.isDesktop).toBe('boolean');
    expect(typeof mod.isMobile).toBe('boolean');
  });
});
