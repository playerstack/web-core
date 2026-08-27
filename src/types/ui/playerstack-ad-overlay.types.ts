/**
 * Types for the `playerstack-ad-overlay` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts), the configurable accessible-name attribute and the ads config type stay documented
 * in one place and the element and any future tests share a single source of truth.
 *
 * The ad configuration reuses `AdsConfig` from `@typings/adapters.types` (the same shape the
 * headless `AdsController` consumes) so the overlay and the controller agree on the contract
 * without redefining it (Req 12: no duplicate/compat types).
 */
import type { AdsConfig } from '@typings/adapters.types';

export type { AdsConfig } from '@typings/adapters.types';

/** Public config type the element's `ads` setter accepts; an alias of `AdsConfig`. */
export type AdOverlayAdsConfig = AdsConfig;

/**
 * Named Shadow DOM `part`s exposed by `playerstack-ad-overlay` so Skins can style the ad
 * overlay through the shadow boundary (Req 5.1, 5.3):
 *   - `ad-overlay` is the overlay container; it carries the reflected `data-active`/
 *     `data-skippable`/`data-can-skip` state so the Style_Layer can show/hide and gate the
 *     skip affordance.
 *   - `ad-skip-button` is the skip affordance.
 *   - `ad-click` is the clickable click-through region.
 *
 * There is intentionally NO `ad-progress` part: the ad progress bar is the normal
 * `playerstack-time-slider` tinted yellow in ad mode (parity with the original, which had a
 * single timeline), so this overlay does not paint its own progress indicator.
 */
export type AdOverlayPart =
  | 'ad-overlay'
  | 'ad-skip-button'
  | 'ad-skip-countdown'
  | 'ad-skip-preview'
  | 'ad-click'
  | 'ad-banner-wrapper'
  | 'ad-banner'
  | 'ad-icon'
  | 'ad-info'
  | 'ad-title'
  | 'ad-url'
  | 'ad-button'
  | 'ad-sponsored';

/**
 * Default accessible name applied to the skip button when the consumer does not set an
 * `aria-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type AdOverlayDefaultLabel = 'Skip ad';
