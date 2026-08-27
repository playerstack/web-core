/**
 * Types for the `playerstack-fullscreen-button` UI_Element. Kept out of the logic file per
 * the type-organization rules (Req 14): the element imports these names, and the
 * Markup_Contract (parts) plus the configurable accessible-name default stay documented in
 * one place so the element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part` exposed by `playerstack-fullscreen-button` so Skins can style the
 * button and its enter/exit glyphs through the shadow boundary (Req 5.1, 5.3). The
 * Style_Layer toggles the glyphs via `[part='fullscreen-button'][data-fullscreen]
 * .icon-enter-fullscreen` selectors, so the icon class names must match those selectors.
 */
export type FullscreenButtonPart = 'fullscreen-button';

/**
 * Default accessible name applied when the consumer does not set an `aria-label` attribute
 * (Req 1.5). English fallback kept as a named constant type so the element and tests agree
 * on the default.
 */
export type FullscreenButtonDefaultLabel = 'Fullscreen';
