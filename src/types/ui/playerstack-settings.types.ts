/**
 * Types for the `playerstack-settings` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts), the configurable accessible-name attribute, the minimal i18n shape and the
 * public quality-option shape stay documented in one place as a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-settings` so Skins can style the
 * settings button, the main menu panel and the per-category submenu through the shadow
 * boundary (Req 5.1, 5.3). The Style_Layer targets these exact names:
 *   - `settings-button` holds the gear glyph and toggles the menu open/closed.
 *   - `menu` is the main panel listing the top-level entries (Speed / Quality).
 *   - `submenu` is the panel shown when a top-level entry is selected.
 *   - `menu-item` / `submenu-item` are the individual selectable rows.
 *   - `menu-item-title` / `menu-item-value` / `menu-item-arrow` are the parts of a main row
 *     (label on the left, current value + right-chevron on the right) matching the original
 *     `StyledDropdownTitle` / `StyledDropdownValue` / `ArrowRightIcon` layout.
 *   - `submenu-header` is the submenu's back-navigation header (`StyledDropdownHeader`);
 *     `submenu-back` is the back button (arrow + category title) inside it.
 *   - `submenu-content` wraps the option list so the slide-in reveal (`StyledDropdownContent`)
 *     can animate independently of the header.
 *   - `hd-badge` is the "HD" sub-label appended to a full-HD quality option
 *     (`StyledDropdownItemValueSub`).
 */
export type SettingsPart =
  | 'settings-button'
  | 'menu'
  | 'submenu'
  | 'menu-item'
  | 'submenu-item'
  | 'menu-item-title'
  | 'menu-item-value'
  | 'menu-item-arrow'
  | 'submenu-header'
  | 'submenu-back'
  | 'submenu-content'
  | 'hd-badge'
  // Caption STYLE config panel (parity with the original desktop `CaptionOptions`), reached via
  // the "Options" affordance in the Captions submenu header. It is a SEPARATE two-level panel:
  // `caption-options` is the panel container, `caption-options-header` holds the back button +
  // an "Options" link, `caption-options-item` is a style row (label + current value + chevron),
  // `caption-options-label`/`caption-options-value` are its left/right parts, and
  // `caption-options-content` wraps the value list of the drilled-in style property.
  | 'submenu-options'
  | 'caption-options'
  | 'caption-options-header'
  | 'caption-options-content'
  | 'caption-options-item'
  | 'caption-options-label'
  | 'caption-options-value';

/**
 * Default accessible name applied to the settings button when the consumer does not set
 * an `aria-label` attribute (Req 1.5). English fallback kept as a named constant type so
 * the element and tests agree on the default.
 */
export type SettingsDefaultLabel = 'Settings';

/**
 * Public quality option shape accepted through the element's `qualityOptions` setter.
 * Mirrors the entry shape `buildSettingsOptions` consumes so callers can feed the same
 * `{ label, value, isFullHD? }` records the rest of Core uses (e.g. `1080`/`1080`).
 */
export interface SettingsQualityOption {
  label: string;
  value: string;
  isFullHD?: boolean;
}

/**
 * Public caption-track shape accepted through the element's `captions` setter. Mirrors the
 * `{ src, label, language }` track descriptors the reactjs skin feeds elsewhere; only `label`
 * (shown in the language list) and `language` (the selection `value`) are used here.
 */
export interface SettingsCaptionTrack {
  label: string;
  language: string;
  src?: string;
}

/**
 * Minimal i18n label bag the element accepts. Every field is optional; missing fields
 * fall back to the English defaults so the element renders correct labels with no i18n
 * provided (Req 1.5). Extra keys are tolerated to stay forward-compatible with the wider
 * translation record used elsewhere in Core.
 */
export interface SettingsI18n {
  speed?: string;
  quality?: string;
  auto?: string;
  normal?: string;
  // Caption labels (parity with the original desktop settings + `CaptionOptions`): the Captions
  // category title, the "Off" row, the "Options" affordance, the nine style-property labels and
  // the "Reset" row. All optional so missing keys fall back to the English defaults.
  captions?: string;
  off?: string;
  captionOptions?: string;
  fontFamily?: string;
  fontColor?: string;
  fontSize?: string;
  fontOpacity?: string;
  backgroundColor?: string;
  backgroundOpacity?: string;
  windowColor?: string;
  windowOpacity?: string;
  edgeStyle?: string;
  reset?: string;
  [key: string]: string | undefined;
}
