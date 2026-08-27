import { getCookie, setCookie, deleteCookie } from '@utils/cookie';

describe('cookie utils', () => {
  beforeEach(() => {
    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]!.trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    });
  });

  it('setCookie and getCookie work together', () => {
    setCookie('test', 'hello');
    expect(getCookie('test')).toBe('hello');
  });

  it('getCookie returns null for nonexistent cookie', () => {
    expect(getCookie('nonexistent')).toBeNull();
  });

  it('deleteCookie removes the cookie', () => {
    setCookie('temp', 'value');
    deleteCookie('temp');
    expect(getCookie('temp')).toBeNull();
  });

  it('handles special characters in cookie values', () => {
    setCookie('special', 'hello=world&foo');
    expect(getCookie('special')).toBe('hello=world&foo');
  });

  it('setCookie with days sets expiration', () => {
    setCookie('expiring', 'val', 7);
    expect(getCookie('expiring')).toBe('val');
  });

  it('setCookie with empty value', () => {
    setCookie('empty', '');
    expect(getCookie('empty')).toBe('');
  });

  it('getCookie handles leading spaces in cookie string', () => {
    // Manually set a cookie with spaces (simulates browser format)
    document.cookie = '  rmp_spaced=value123; path=/';
    expect(getCookie('spaced')).toBe('value123');
  });

  it('getCookie handles URL-encoded characters', () => {
    setCookie('encoded', 'hello world/test');
    expect(getCookie('encoded')).toBe('hello world/test');
  });

  it('multiple cookies coexist', () => {
    setCookie('first', 'one');
    setCookie('second', 'two');
    setCookie('third', 'three');
    expect(getCookie('first')).toBe('one');
    expect(getCookie('second')).toBe('two');
    expect(getCookie('third')).toBe('three');
  });
});

describe('cookie utils — edge cases', () => {
  it('getCookie handles malformed encoded value (decodeURIComponent catch)', () => {
    // Set a cookie with a value that will fail decodeURIComponent
    document.cookie = 'rmp_bad=%E0%A4%A; path=/';
    // Should return the raw value without throwing
    const result = getCookie('bad');
    expect(result).not.toBeNull();
  });

  it('setCookie without days does not include expires', () => {
    setCookie('noexpiry', 'val');
    expect(document.cookie).toContain('rmp_noexpiry=val');
  });
});
