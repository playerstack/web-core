/**
 * Types for the `playerstack-captions` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the caption-source input shape stay documented in one place so the element and
 * any future tests share a single source of truth. The cue shape is reused from the shared
 * caption types (Req 1.6) so the overlay never redefines the VTT cue model.
 */
import type { VTTCue } from '@typings/utils/captions.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-captions` so Skins can style the caption
 * overlay container and its active cue text region through the shadow boundary (Req 5.1,
 * 5.3):
 *   - `captions` is the overlay container; it carries the reflected `data-active` state.
 *   - `cue` is the text region that receives the active cue text on every store change.
 */
export type CaptionsPart = 'captions' | 'caption-window' | 'cue';

/**
 * Caption source the consumer/adapter supplies. The overlay accepts either a raw VTT string
 * (parsed with `parseVTTCaptions`, Req 1.6) or an already-parsed cue array so an adapter that
 * fetched and parsed a `spriteVttFile`-like source can hand cues straight in. The VTT fetch
 * stays with the consumer/adapter — this element never performs network access.
 */
export type CaptionsSource = string | VTTCue[];

/**
 * Detail payload for the `playerstack-caption-request` event dispatched by
 * `playerstack-captions` when an external caption track is selected via `selectCaption`
 * (Req 2.1, 21.1). `value` identifies the chosen caption track (e.g. a language code or
 * track id); the surrounding application/adapter resolves it to the actual track. This
 * mirrors the reactjs skin's `onCaptionChange` callback through the Request/Response model.
 */
export interface CaptionRequestDetail {
  value: string;
}
