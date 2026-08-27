/**
 * Types for the `playerstack-nav-buttons` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable accessible-name defaults stay documented in one place so the
 * element and any future tests share a single source of truth.
 *
 * WHY this element exists: the reactjs skin exposes a `showNavButtons` affordance with
 * previous/next controls; Core provides the framework-agnostic UI_Element so a `prev`/`next`
 * intent can be expressed uniformly through the Request/Response model (Req 2.1, 21.1).
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-nav-buttons` so Skins can style the
 * navigation cluster and each button through the shadow boundary (Req 5.1, 5.3):
 *   - `nav-buttons` is the container that wraps both buttons.
 *   - `prev-button` is the "previous" `<button>`; it holds an `.icon.icon-prev` glyph.
 *   - `next-button` is the "next" `<button>`; it holds an `.icon.icon-next` glyph.
 */
export type NavButtonsPart = 'nav-buttons' | 'prev-button' | 'next-button';

/**
 * Default accessible name applied to the previous button when the consumer does not set a
 * `prev-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type NavPrevDefaultLabel = 'Previous';

/**
 * Default accessible name applied to the next button when the consumer does not set a
 * `next-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type NavNextDefaultLabel = 'Next';
