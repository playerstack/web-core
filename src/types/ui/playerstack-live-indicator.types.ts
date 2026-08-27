/**
 * Types for the `playerstack-live-indicator` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts) and the DVR state contract the element reflects stay documented in one place and
 * the element and any future tests share a single source of truth.
 *
 * The DVR state reuses `LiveDVRState` from `@typings/live-dvr.types` (the same shape the
 * headless `computeLiveDVRState` / `LiveDVRController` produce) so the indicator and the
 * headless layer agree on the contract without redefining it (Req 12: no duplicate/compat
 * types).
 */
import type { LiveDVRState } from '@typings/live-dvr.types';

export type { LiveDVRState } from '@typings/live-dvr.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-live-indicator` so Skins can style the
 * live indicator through the shadow boundary (Req 5.1, 5.3):
 *   - `live-indicator` is the container; it carries the reflected `data-live`/`data-at-edge`
 *     state so the Style_Layer can color the dot and label.
 *   - `live-dot` is the LIVE status dot.
 *   - `live-label` is the "Live" text label.
 *
 * The negative live offset is intentionally NOT a part of this element — it is shown by the
 * time read-out (`playerstack-play-time`), matching the monolith (avoids a duplicated offset).
 */
export type LiveIndicatorPart = 'live-indicator' | 'live-dot' | 'live-label';

/** Public DVR state type the element's `dvrState` setter accepts; an alias of `LiveDVRState`. */
export type LiveIndicatorDVRState = LiveDVRState;
