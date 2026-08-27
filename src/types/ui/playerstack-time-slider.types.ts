/**
 * Types for the `playerstack-time-slider` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts), the configurable accessible-name attribute and the sprite-data shape stay
 * documented in one place so the element and any future tests share a single source of truth.
 */
import type { SpriteCue } from '@typings/sprite.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-time-slider` so Skins can style the
 * progress track, the played/buffered fills, the thumb, the time tooltip and the timelens
 * thumbnail preview through the shadow boundary (Req 5.1, 5.3). The Style_Layer targets these
 * exact names:
 *   - `time-slider` is the outer container / state hook.
 *   - `slider` / `track` / `track-fill` / `track-buffered` / `thumb` reuse the shared slider
 *     primitives; `track-fill` mirrors the played fraction and `track-buffered` the loaded one.
 *   - `tooltip` positions the hover-time TimeTooltip.
 *   - `timelens` positions the sprite thumbnail preview shown while hovering.
 */
export type TimeSliderPart =
  | 'time-slider'
  | 'slider'
  | 'track'
  | 'track-fill'
  | 'track-buffered'
  | 'thumb'
  | 'tooltip'
  | 'tooltip-time'
  | 'tooltip-chapter'
  | 'timelens'
  | 'chapters'
  | 'chapter-segment'
  | 'chapter-segment-buffered'
  | 'chapter-segment-filled';

/**
 * Default accessible name applied to the slider when the consumer does not set an
 * `aria-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type TimeSliderDefaultLabel = 'Seek';

/**
 * Sprite data the consumer/adapter supplies to enable the timelens thumbnail preview. The
 * VTT fetch and image loading live in the framework adapters (e.g. the reactjs migration in
 * task 14.x); this element only needs the parsed cues plus each sheet's pixel dimensions to
 * compute the frame geometry via `computeSpriteFrame`. When absent, the timelens stays hidden.
 */
export interface TimeSliderSpriteData {
  /** Parsed sprite cues with numeric coordinates, reused from the sprite types (Req 1.6). */
  cues: SpriteCue[];
  /** Map of sprite sheet file URLs to their pixel dimensions. */
  sheetSizes: Record<string, { w: number; h: number }>;
}
