/**
 * Types for the `playerstack-audio-controls` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names so the Markup_Contract
 * (parts) plus the configurable accessible-name attribute stay documented in one place and
 * the element and any future tests share a single source of truth.
 */
import type { ChapterInput } from '@typings/chapters.types';
import type { AdsConfig } from '@typings/adapters.types';

/**
 * Named `part`s exposed by `playerstack-audio-controls` so skins can style the compact audio
 * control bar (Req 5.1, 5.3). This element reproduces the original audio skin's single control
 * row (`StyledControlsRow`): transport buttons, a paused-label↔timeline content area, the
 * remaining-time read-out and the seek timeline (single track OR chapter segments):
 *   - `audio-controls` is the flex row container; it carries `data-playing`/`data-ended`/
 *     `data-buffering`/`data-ad-active` so the Style_Layer swaps affordances and reveals the
 *     skip buttons / morphs the label into the timeline.
 *   - `skip-back-button` / `skip-forward-button` are the ±10s transport buttons that reveal
 *     while playing (StyledSkipButtonWrapper `$visible`); hidden during ads.
 *   - `play-button` is the play/pause/replay toggle; in ad mode it becomes the skip-ad button.
 *   - `content-area` stacks the paused `media-label` and the `timeline-wrapper` in one cell.
 *   - `media-label` / `media-label-prefix` are the paused "Play:/Replay:" title+chapter line.
 *   - `timeline-wrapper` reveals (clip-path) while playing and holds the seek `slider`.
 *   - `slider` / `track` are the seek bar and its rail; `track-fill` the played portion and
 *     `track-buffered` a buffered range; `loading-stripes` the animated buffering shimmer.
 *   - `chapter-segment` / `chapter-fill` / `chapter-buffered` are the per-chapter rail pieces.
 *   - `tooltip` / `tooltip-chapter` / `tooltip-time` are the hover read-out above the timeline.
 *   - `time` is the remaining-time read-out (`-M:SS`).
 */
export type AudioControlsPart =
  | 'audio-controls'
  | 'skip-back-button'
  | 'skip-forward-button'
  | 'play-button'
  | 'content-area'
  | 'media-label'
  | 'media-label-prefix'
  | 'timeline-wrapper'
  | 'time'
  | 'slider'
  | 'track'
  | 'track-fill'
  | 'track-buffered'
  | 'track-hover'
  | 'loading-stripes'
  | 'chapter-segment'
  | 'chapter-fill'
  | 'chapter-buffered'
  | 'chapter-hover'
  | 'thumb'
  | 'tooltip'
  | 'tooltip-chapter'
  | 'tooltip-time';

/**
 * Default accessible name applied to the play/pause button when the consumer does not set an
 * `aria-label` attribute (Req 1.5). English fallback kept as a named constant type so the
 * element and tests agree on the default.
 */
export type AudioControlsDefaultLabel = 'Play';

/**
 * Rich chapter markers supplied by the consumer/adapter via the `chapters` property channel.
 * Reuses the shared `ChapterInput` shape so the audio bar and `playerstack-chapters` agree.
 */
export type AudioControlsChapters = ChapterInput[] | null;

/**
 * Ad configuration supplied via the `ads` property channel. Reuses the shared `AdsConfig` so
 * the audio bar's ad-mode (skip button + countdown) matches the rest of Core's ads model.
 */
export type AudioControlsAds = AdsConfig | null;
