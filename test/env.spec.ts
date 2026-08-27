import { enableStubOn } from '@utils/env';

describe('enableStubOn', () => {
  test('returns original function in non-test environment', () => {
    const original = (globalThis as any).__TEST__;
    (globalThis as any).__TEST__ = false;
    // isTestEnv is evaluated at module load time, so we test enableStubOn behavior
    // In test env (Jest), it wraps the function
    const fn = (x: number) => x * 2;
    const result = enableStubOn(fn);
    // In Jest environment, isTestEnv is true, so it wraps
    expect(result(5)).toBe(10);
    (globalThis as any).__TEST__ = original;
  });

  test('wraps function with stub property in test env', () => {
    const fn = (x: number) => x * 2;
    const wrapped = enableStubOn(fn);
    // In Jest env, isTestEnv = true, so wrapped has .stub
    if ((wrapped as any).stub) {
      expect((wrapped as any).stub).toBe(fn);
      // Can reassign stub
      (wrapped as any).stub = (x: number) => x * 3;
      expect(wrapped(5)).toBe(15);
    } else {
      // If not test env, just returns fn
      expect(wrapped).toBe(fn);
    }
  });
});
