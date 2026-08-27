/**
 * Types for the `playerstack-play-state` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable accessible-name attribute stay documented in one place so the
 * element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-play-state` so Skins can style the center
 * overlay and its big play/pause/replay affordance through the shadow boundary (Req 5.1,
 * 5.3):
 *   - `play-state` is the overlay container; it carries the reflected `data-playing`/
 *     `data-ended` state so the Style_Layer can swap the affordance glyph.
 *   - `play-state-button` is the clickable center affordance.
 */
export type PlayStatePart = 'play-state' | 'play-state-button';

/**
 * Default accessible name applied when the consumer does not set an `aria-label` attribute
 * (Req 1.5). English fallback kept as a named constant type so the element and tests agree on
 * the default.
 */
export type PlayStateDefaultLabel = 'Play';
