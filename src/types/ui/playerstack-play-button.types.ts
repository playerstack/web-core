/**
 * Types for the `playerstack-play-button` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable accessible-name attribute stay documented in one place so
 * the element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-play-button` so Skins can style the
 * button and its play/pause glyphs through the shadow boundary (Req 5.1, 5.3). The
 * Style_Layer toggles the glyphs via `[part='play-button'][data-playing] .icon-play`
 * selectors, so the icon class names below must match those selectors.
 */
export type PlayButtonPart = 'play-button';

/**
 * Default accessible name applied when the consumer does not set an `aria-label` attribute
 * (Req 1.5). English fallback kept as a named constant type so the element and tests agree
 * on the default.
 */
export type PlayButtonDefaultLabel = 'Play';
