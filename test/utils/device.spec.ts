/**
 * Tests for device detection utilities.
 * The module uses side-effect detection on import, so we test by
 * manipulating globals before importing.
 */

describe('device detection', () => {
  const originalNavigator = window.navigator;
  const originalOntouchstart = (window as any).ontouchstart;

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    if (originalOntouchstart !== undefined) {
      (window as any).ontouchstart = originalOntouchstart;
    } else {
      delete (window as any).ontouchstart;
    }
    jest.resetModules();
  });

  it('exports isDesktop and isMobile as booleans', () => {
    const { isDesktop, isMobile } = require('../../src/utils/device');
    expect(typeof isDesktop).toBe('boolean');
    expect(typeof isMobile).toBe('boolean');
  });

  it('detects desktop when no touch and desktop UA', () => {
    delete (window as any).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true,
    });
    jest.resetModules();
    const { isDesktop, isMobile } = require('../../src/utils/device');
    expect(isDesktop).toBe(true);
    expect(isMobile).toBe(false);
  });

  it('detects mobile for iPhone UA', () => {
    (window as any).ontouchstart = true;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      configurable: true,
    });
    jest.resetModules();
    const { isDesktop, isMobile } = require('../../src/utils/device');
    expect(isDesktop).toBe(false);
    expect(isMobile).toBe(true);
  });

  it('detects mobile for Android tablet', () => {
    (window as any).ontouchstart = true;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 12; Pixel Slate) AppleWebKit/537.36',
      configurable: true,
    });
    jest.resetModules();
    const { isDesktop, isMobile } = require('../../src/utils/device');
    expect(isDesktop).toBe(false);
    expect(isMobile).toBe(true);
  });

  it('detects mobile for iPad UA', () => {
    (window as any).ontouchstart = true;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
      configurable: true,
    });
    jest.resetModules();
    const { isDesktop, isMobile } = require('../../src/utils/device');
    expect(isDesktop).toBe(false);
    expect(isMobile).toBe(true);
  });

  it('non-touch unknown UA defaults to isMobile', () => {
    (window as any).ontouchstart = true;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 2, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'SomeUnknownUA',
      configurable: true,
    });
    jest.resetModules();
    const { isDesktop, isMobile } = require('../../src/utils/device');
    // No mobile/tablet pattern, no desktop pattern, but has touch = not desktop
    expect(isDesktop).toBe(false);
    expect(isMobile).toBe(true);
  });
});
