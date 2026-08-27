const COOKIE_PREFIX = 'rmp_';

/**
 * Get a cookie value by name.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const nameEQ = `${COOKIE_PREFIX}${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]!;
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      } catch {
        return c.substring(nameEQ.length, c.length);
      }
    }
  }
  return null;
}

/**
 * Set a cookie with optional expiry in days.
 */
export function setCookie(name: string, value: string, days?: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${COOKIE_PREFIX}${name}=${encodeURIComponent(value || '')}${expires}; path=/`;
}

/**
 * Delete a cookie by name.
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${COOKIE_PREFIX}${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}
