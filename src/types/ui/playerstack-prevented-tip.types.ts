/**
 * Types for the `playerstack-prevented-tip` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable language attribute stay documented in one place so the
 * element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-prevented-tip` so Skins can style the
 * blocked-playback tip region and its text through the shadow boundary (Req 5.1, 5.3):
 *   - `prevented-tip` is the tip pill (top-left) holding the icon + message.
 *   - `prevented-tip-icon` is the leading glyph (play when stuck / muted when unmute).
 *   - `prevented-tip-message` is the text region that receives the i18n tip message.
 *   - `prevented-tip-clicked` is the full-stage transparent click-catcher shown ONLY for the
 *     "click to unmute" case (parity with the original `StyledPeventedTipClicked`).
 */
export type PreventedTipPart =
  'prevented-tip' | 'prevented-tip-icon' | 'prevented-tip-message' | 'prevented-tip-clicked';

/**
 * Default language code applied when the consumer does not set a `language` attribute. The
 * i18n layer falls back to English for unknown codes, so `en` is the safe default (Req 1.4).
 */
export type PreventedTipDefaultLanguage = 'en';
