/**
 * Types for the `playerstack-top-state` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable language attribute stay documented in one place so the
 * element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-top-state` so Skins can style the top
 * status region and its message text through the shadow boundary (Req 5.1, 5.3):
 *   - `top-state` is the status region container; it carries a reflected `data-active` toggle
 *     the Style_Layer uses to show/hide the region when a message is present.
 *   - `top-state-message` is the text region that receives the i18n status message.
 */
export type TopStatePart = 'top-state' | 'top-state-message';

/**
 * Default language code applied when the consumer does not set a `language` attribute. The
 * i18n layer falls back to English for unknown codes, so `en` is the safe default (Req 1.4).
 */
export type TopStateDefaultLanguage = 'en';
