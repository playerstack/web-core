/**
 * Types for the `playerstack-double-tap` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts) and the double-tap config/state contracts stay documented in one place and the
 * element and any future tests share a single source of truth.
 *
 * The config and skip state reuse `DoubleTapConfig` / `SkipState` from
 * `@typings/double-tap-controller.types` (the same shapes the headless `DoubleTapController`
 * consumes and emits) so the overlay and the controller agree on the contract without
 * redefining it (Req 12: no duplicate/compat types).
 */
import type { DoubleTapConfig, SkipState } from '@typings/double-tap-controller.types';

export type { DoubleTapConfig, SkipState } from '@typings/double-tap-controller.types';

/** Public config type the element's `config` setter accepts; an alias of `DoubleTapConfig`. */
export type DoubleTapElementConfig = DoubleTapConfig;

/** Public skip-state type mirrored to the skip indicator; an alias of `SkipState`. */
export type DoubleTapSkipState = SkipState;

/**
 * Named Shadow DOM `part`s exposed by `playerstack-double-tap` so Skins can style the
 * double-tap overlay through the shadow boundary (Req 5.1, 5.3):
 *   - `double-tap` is the overlay container.
 *   - `double-tap-left` is the left (backward skip) gesture zone.
 *   - `double-tap-right` is the right (forward skip) gesture zone.
 *   - `skip-indicator` shows the accumulated skip seconds; it carries the reflected
 *     `data-active`/`data-direction` state so the Style_Layer can show/hide and orient it.
 */
export type DoubleTapPart =
  | 'double-tap'
  | 'double-tap-left'
  | 'double-tap-right'
  | 'skip-indicator'
  | 'skip-indicator-icons'
  | 'skip-indicator-text';
