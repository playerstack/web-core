import type { PlayerAdapter } from '@typings/adapters.types';

/**
 * Union of the required method names of the `PlayerAdapter` interface.
 * Derived from `PlayerAdapter` so it stays in sync with the contract, and
 * used by `assertPlayerAdapter` to report a missing method by name (Req 2.5).
 */
export type PlayerAdapterMethodName = keyof PlayerAdapter;

/**
 * The list of required `PlayerAdapter` method names checked for conformance.
 */
export type PlayerAdapterMethodList = readonly PlayerAdapterMethodName[];
