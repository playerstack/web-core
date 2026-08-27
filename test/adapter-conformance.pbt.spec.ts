import fc from 'fast-check';

import { assertPlayerAdapter } from '@ui/adapter-conformance';

/**
 * The complete list of method names required by the `PlayerAdapter` contract.
 * Mirrors `REQUIRED_METHODS` in `src/ui/adapter-conformance.ts`; kept local so the
 * test asserts the contract independently of the implementation's internal list.
 */
const ALL = [
  'play',
  'pause',
  'stop',
  'load',
  'seekTo',
  'setVolume',
  'mute',
  'unmute',
  'setPlaybackRate',
  'getDuration',
  'getCurrentTime',
  'getSecondsLoaded',
] as const;

type AdapterMethod = (typeof ALL)[number];

/** Builds an adapter object exposing exactly the given method names as functions. */
const buildAdapter = (methods: readonly AdapterMethod[]): Record<string, unknown> =>
  Object.fromEntries(methods.map((m) => [m, () => undefined]));

/** Escapes a string for safe use inside a `RegExp`. */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('adapter-conformance PBT', () => {
  // Feature: framework-agnostic-ui-core, Property 5: Conformidad del Provider_Adapter
  it('Property 5: Conformidad del Provider_Adapter — complete adapters are accepted', () => {
    // Validates: Requirements 2.4, 2.5, 20.5
    fc.assert(
      // Shuffle insertion order and optionally add extra unrelated props: a COMPLETE
      // adapter must always be accepted regardless of key order or extra members.
      fc.property(
        fc.shuffledSubarray(ALL, { minLength: ALL.length }),
        fc.dictionary(
          fc.string(),
          fc.constant(() => undefined),
        ),
        (order, extras) => {
          const complete = { ...extras, ...buildAdapter(order) };
          expect(() => assertPlayerAdapter(complete)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: framework-agnostic-ui-core, Property 5: Conformidad del Provider_Adapter
  it('Property 5: Conformidad del Provider_Adapter — incomplete adapters throw naming every omitted method', () => {
    // Validates: Requirements 2.4, 2.5, 20.5
    fc.assert(
      fc.property(fc.subarray([...ALL], { minLength: 1 }), (toOmit) => {
        const omit = new Set<AdapterMethod>(toOmit);
        const adapter = buildAdapter(ALL.filter((m) => !omit.has(m)));

        // The assertion MUST fail for any non-empty set of omitted methods.
        expect(() => assertPlayerAdapter(adapter)).toThrow();

        // And the thrown message MUST name EACH omitted method.
        let message = '';
        try {
          assertPlayerAdapter(adapter);
        } catch (error) {
          message = (error as Error).message;
        }
        for (const method of toOmit) {
          expect(message).toMatch(new RegExp(escapeRegExp(method)));
        }
      }),
      { numRuns: 100 },
    );
  });
});
