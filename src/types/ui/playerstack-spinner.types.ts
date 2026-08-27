/**
 * Types for the `playerstack-spinner` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) stays documented in one place so the element and any future tests share a single
 * source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-spinner` so Skins can style the loading
 * overlay and its animated indicator through the shadow boundary (Req 5.1, 5.3):
 *   - `spinner` is the overlay container; it carries the reflected loading/buffering state
 *     (`data-loading`/`data-buffering`) plus a convenience `data-active` toggle.
 *   - `spinner-indicator` is the animated glyph the Style_Layer spins.
 */
export type SpinnerPart = 'spinner' | 'spinner-indicator';
