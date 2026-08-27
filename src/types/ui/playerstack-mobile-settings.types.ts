/**
 * Types for the `playerstack-mobile-settings` UI_Element — the full-surface mobile settings
 * panel (parity with the original `MobileSettingsPanel`). Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts), the public quality-option shape, the caption-track shape and the minimal i18n shape
 * stay documented in one place.
 */

/**
 * Named `part`s exposed by `playerstack-mobile-settings` so Skins can style the sliding panel,
 * its header (gear/back + title + close), the main "switches" grid (quality / speed / captions
 * cards showing the current value) and the per-category option sub-page:
 *   - `mobile-settings-panel` is the sliding overlay container (host reflects `data-settings-open`).
 *   - `mobile-settings-header` / `mobile-settings-title` / `mobile-settings-back` /
 *     `mobile-settings-close` compose the header row.
 *   - `mobile-settings-grid` holds the main-page switch cards; `mobile-settings-switch` is a card
 *     with `mobile-settings-switch-icon` / `mobile-settings-switch-label` /
 *     `mobile-settings-switch-value`.
 *   - `mobile-settings-subpage` is the option sub-page; `mobile-settings-option` is each row
 *     (carries `data-active` for the selected option).
 */
export type MobileSettingsPart =
  | 'mobile-settings-panel'
  | 'mobile-settings-header'
  | 'mobile-settings-title'
  | 'mobile-settings-back'
  | 'mobile-settings-close'
  | 'mobile-settings-grid'
  | 'mobile-settings-switch'
  | 'mobile-settings-switch-icon'
  | 'mobile-settings-switch-label'
  | 'mobile-settings-switch-value'
  | 'mobile-settings-mainpage'
  | 'mobile-settings-subpage'
  | 'mobile-settings-option';

/** The top-level categories the panel can drill into. */
export type MobileSettingsCategory = 'quality' | 'speed' | 'captions';

/** Public quality option shape (mirrors `playerstack-settings`). */
export interface MobileSettingsQualityOption {
  label: string;
  value: string;
  isFullHD?: boolean;
}

/** Public caption track shape accepted through the `captions` setter. */
export interface MobileSettingsCaptionTrack {
  label: string;
  language: string;
}

/** Minimal i18n label bag; missing fields fall back to the English defaults. */
export interface MobileSettingsI18n {
  settings?: string;
  quality?: string;
  speed?: string;
  captions?: string;
  auto?: string;
  normal?: string;
  off?: string;
  back?: string;
  close?: string;
  [key: string]: string | undefined;
}
