/**
 * Detect if running in a test environment (Jest, jsdom, etc.)
 * Used to disable features that don't work in synthetic DOM (e.g. Shadow DOM).
 */
export const isTestEnv =
  typeof globalThis !== 'undefined' &&
  ((globalThis as any).__TEST__ ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') ||
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom')));

/**
 * Enable stubbing on a function (test helper).
 * In test environments, wraps function so `.stub` property can be reassigned.
 */
export function enableStubOn<T extends (...args: any[]) => any>(fn: T): T {
  if (isTestEnv) {
    const wrap = ((...args: any[]) => (wrap as any).stub(...args)) as any;
    wrap.stub = fn;
    return wrap;
  }
  return fn;
}
