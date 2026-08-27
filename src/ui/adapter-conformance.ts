/**
 * Runtime conformance check for the `PlayerAdapter` contract (Req 2.4, 2.5, 18.1).
 *
 * `assertPlayerAdapter` validates — at runtime — that an unknown value implements every
 * method required by the `PlayerAdapter` interface. It is used at UI/adapter boundaries
 * where TypeScript's compile-time guarantees do not apply (e.g. adapters coming from
 * untyped JS consumers or across a framework boundary).
 *
 * WHY throw instead of returning a boolean: a missing adapter method is a programming
 * error the consumer must fix, not a recoverable condition. Failing loudly with a
 * descriptive message that NAMES the offending method(s) makes the contract violation
 * obvious at the call site. Nothing here is silenced — no try/catch swallows errors.
 *
 * This module is pure aside from the intentional `throw`: no DOM access and no other
 * side-effects.
 */
import type { PlayerAdapter } from '@typings/adapters.types';
import type { PlayerAdapterMethodName, PlayerAdapterMethodList } from '@typings/ui/adapter-conformance.types';

/**
 * The complete list of method names required by `PlayerAdapter`.
 *
 * WHY it is typed as `PlayerAdapterMethodList` (`readonly (keyof PlayerAdapter)[]`):
 * TypeScript will error if any entry is not an actual method name of `PlayerAdapter`,
 * so this runtime list can never silently drift from the interface. If a method is
 * added to `PlayerAdapter` it should also be added here to be enforced at runtime.
 */
const REQUIRED_METHODS: PlayerAdapterMethodList = [
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
];

/**
 * Asserts that `adapter` implements every method of the `PlayerAdapter` contract
 * (Req 2.4, 2.5). On success, narrows `adapter` to `PlayerAdapter` via the `asserts`
 * return type so callers get full typing afterwards.
 *
 * Throws a descriptive `Error` that NAMES the missing method(s) when:
 * - `adapter` is not a non-null object, or
 * - one or more required methods are absent or not functions.
 *
 * All missing methods are collected and reported together, so a single failure surfaces
 * the full set of contract violations rather than only the first one.
 */
export function assertPlayerAdapter(adapter: unknown): asserts adapter is PlayerAdapter {
  // A valid adapter must first be a non-null object; primitives/null/functions cannot
  // carry the required methods.
  if (adapter === null || typeof adapter !== 'object') {
    throw new Error(
      `PlayerAdapter must be a non-null object but received ${adapter === null ? 'null' : typeof adapter}.`,
    );
  }

  // Index the value by string key to probe each required method without `any`.
  const candidate = adapter as Record<string, unknown>;

  const missing: PlayerAdapterMethodName[] = [];
  for (const method of REQUIRED_METHODS) {
    if (typeof candidate[method] !== 'function') {
      missing.push(method);
    }
  }

  if (missing.length > 0) {
    const label = missing.length === 1 ? 'method' : 'methods';
    const names = missing.map((name) => `"${name}"`).join(', ');
    throw new Error(`PlayerAdapter is missing required ${label}: ${names}.`);
  }
}
