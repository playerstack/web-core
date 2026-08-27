/**
 * Types for the `playerstack-play-time` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) stays documented in one place so the element and any future tests share a single
 * source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-play-time` so Skins can style the time
 * container and its current-time / duration spans through the shadow boundary (Req 5.1, 5.3).
 * `time` is the wrapper, `current-time` mirrors the store's `seek` and `duration` mirrors the
 * store's `duration`, both formatted through `formatTime` (Req 1.6).
 */
export type PlayTimePart = 'time' | 'current-time' | 'duration';
