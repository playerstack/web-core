/**
 * Example/edge tests for `assertPlayerAdapter` (Req 2.4, 2.5, 17.5).
 *
 * The property test (`adapter-conformance.pbt.spec.ts`) covers complete/incomplete
 * OBJECT adapters. These examples cover the non-object guard branch — the descriptive
 * error when the value is `null` vs another primitive `typeof` — which the object-shaped
 * generators can't reach.
 */
import { assertPlayerAdapter } from '@ui/adapter-conformance';

describe('assertPlayerAdapter non-object guard (Req 2.4, 2.5)', () => {
  it('throws naming "null" when the adapter is null', () => {
    expect(() => assertPlayerAdapter(null)).toThrow(/non-null object but received null/);
  });

  it('throws naming the typeof when the adapter is a primitive number', () => {
    expect(() => assertPlayerAdapter(42)).toThrow(/non-null object but received number/);
  });

  it('throws naming the typeof when the adapter is a function', () => {
    expect(() => assertPlayerAdapter(() => undefined)).toThrow(/non-null object but received function/);
  });

  it('reports a single missing method with the singular "method" label', () => {
    const almost: Record<string, unknown> = {
      play: () => undefined,
      pause: () => undefined,
      stop: () => undefined,
      load: () => undefined,
      seekTo: () => undefined,
      setVolume: () => undefined,
      mute: () => undefined,
      unmute: () => undefined,
      setPlaybackRate: () => undefined,
      getDuration: () => undefined,
      getCurrentTime: () => undefined,
      // getSecondsLoaded intentionally omitted.
    };
    expect(() => assertPlayerAdapter(almost)).toThrow(/missing required method: "getSecondsLoaded"/);
  });
});
