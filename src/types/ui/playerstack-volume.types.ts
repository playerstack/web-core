/**
 * Types for the `playerstack-volume` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable accessible-name attribute stay documented in one place so
 * the element and any future tests share a single source of truth.
 */

/**
 * Named Shadow DOM `part`s exposed by `playerstack-volume` so Skins can style the mute
 * button, its volume/muted glyphs and the volume slider through the shadow boundary
 * (Req 5.1, 5.3). The Style_Layer targets these exact names:
 *   - `mute-button` swaps its glyph via `[part='mute-button'][data-muted] .icon-volume`
 *     / `[part='mute-button']:not([data-muted]) .icon-muted`.
 *   - `volume` dims the fill when muted via `[part='volume'][data-muted] [part='track-fill']`.
 *   - `slider` / `track` / `track-fill` / `thumb` reuse the shared slider primitives.
 *   - `volume-tooltip` is the floating percentage read-out shown while hovering/dragging the
 *     slider (`StyledVolumePercentTooltip`); it carries `data-visible` to fade in/out.
 */
export type VolumePart = 'mute-button' | 'volume' | 'slider' | 'track' | 'track-fill' | 'thumb' | 'volume-tooltip';

/**
 * Default accessible name applied to the mute button when the consumer does not set an
 * `aria-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type VolumeDefaultLabel = 'Mute';
