/**
 * Tests for uncovered branches in utils (cookie, device, env).
 */
import { getCookie, setCookie, deleteCookie } from '@utils/cookie';
import { isDesktop, isMobile } from '@utils/device';
import { isTestEnv } from '@utils/env';

describe('cookie utils', () => {
  test('getCookie returns null when cookie not found', () => {
    expect(getCookie('nonexistent_key_xyz')).toBeNull();
  });

  test('setCookie does not throw', () => {
    expect(() => setCookie('test_key', 'test_val', 7)).not.toThrow();
  });

  test('deleteCookie does not throw', () => {
    expect(() => deleteCookie('test_key')).not.toThrow();
  });

  test('getCookie with empty name returns null', () => {
    expect(getCookie('')).toBeNull();
  });
});

describe('device utils', () => {
  test('isDesktop is boolean', () => {
    expect(typeof isDesktop).toBe('boolean');
  });

  test('isMobile is boolean', () => {
    expect(typeof isMobile).toBe('boolean');
  });
});

describe('env utils', () => {
  test('isTestEnv is true in Jest', () => {
    expect(isTestEnv).toBe(true);
  });
});
