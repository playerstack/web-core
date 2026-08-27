/**
 * Types for the controller-scoped Tooltip_Manager. Kept out of the logic file per the
 * type-organization rules (Req 14): the manager imports these names so the constructor
 * parameter shape and the exposed `part` name stay documented in one place.
 */

/**
 * Construction parameters for `TooltipManager`. `host` is the root player element
 * (`playerstack-media-controller`) that acts BOTH as the delegation root for hover events and
 * as the clamping bounding box — the tooltip is kept within its rectangle, exactly like the
 * original `Tooltip` clamped against `playerRef` (Req parity).
 */
export interface TooltipManagerParams {
  /** The root player host: hover-delegation root + clamping bounding box. */
  host: HTMLElement;
}

/**
 * The single `part` name the manager exposes on its floating tooltip node so the Style_Layer
 * can style it (`[part='tooltip-label']`). Named distinctly from the time-slider's
 * `[part='tooltip']` so the two never collide.
 */
export type TooltipManagerPart = 'tooltip-label';
