/**
 * Live DVR (Digital Video Recording) utilities.
 *
 * Provides framework-agnostic logic for live stream time-shifting:
 * - Determines the seekable DVR window from the video element's seekable TimeRanges
 * - Computes "live edge" position and whether the user is at the edge
 * - Calculates negative offset display (e.g., "-1:20:06" when behind live)
 *
 * How live DVR works:
 * HLS/DASH live streams expose a sliding seekable window via the video element's
 * `seekable` property. As new segments arrive, the window advances. The "live edge"
 * is the end of this window (the most current content). Users can seek backwards
 * within this window (DVR), and the UI shows a negative offset from live.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seekable
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/setLiveSeekableRange
 */

import type { LiveDVRState, LiveDVRConfig } from '@typings/live-dvr.types';

export type { LiveDVRState, LiveDVRConfig } from '@typings/live-dvr.types';

const DEFAULT_CONFIG: Required<LiveDVRConfig> = {
  minDVRWindow: 15,
  liveEdgeTolerance: 18,
  liveEdgeHysteresis: 12,
};

/**
 * Extra seconds subtracted from the ENTER threshold before the edge flag is allowed to drop.
 * Combined with `liveEdgeTolerance` this forms a two-level (Schmitt-trigger) test: you become
 * "at edge" within `liveEdgeTolerance` of the live edge, and only stop being at edge once you
 * fall behind by MORE than `liveEdgeTolerance + liveEdgeHysteresis`. Kept as a fallback for the
 * `liveEdgeHysteresis` config field so older callers still get hysteresis.
 */
const DEFAULT_HYSTERESIS = 12;

/**
 * Determine `isAtLiveEdge` with hysteresis so a live stream's naturally jittery `seekableEnd`
 * (it extends in discrete segment-sized steps as new segments arrive, while `currentTime`
 * advances smoothly) does NOT flip the flag on and off. This is the core of the fix for the
 * offset oscillating (-3,-4,-7,-5,…) and eventually drifting to the grey "behind live" dot while
 * the viewer is actually watching live.
 *
 * Two-level test (Schmitt trigger):
 *   - to ENTER the edge: `offset >= -tolerance` (within `tolerance`s of the live edge);
 *   - to EXIT the edge (only if we were already at it): `offset < -(tolerance + hysteresis)`.
 * Between the two thresholds the previous state is kept, so small `seekableEnd` steps that push
 * the offset a few seconds past `-tolerance` no longer flip the badge to grey.
 */
export function isAtLiveEdgeWithHysteresis(
  liveEdgeOffset: number,
  tolerance: number,
  hysteresis: number,
  previousAtEdge: boolean,
): boolean {
  // `liveEdgeOffset` is negative when behind live (currentTime - seekableEnd).
  if (previousAtEdge) {
    // Stay at edge until we fall clearly behind (wider exit band).
    return liveEdgeOffset >= -(tolerance + hysteresis);
  }
  // Enter the edge only when genuinely close to live.
  return liveEdgeOffset >= -tolerance;
}

/**
 * Compute the live DVR state from a media element.
 *
 * Call this on each timeupdate/progress event to get up-to-date DVR state. Pass the PREVIOUS
 * `isAtLiveEdge` so the edge detection applies hysteresis (see `isAtLiveEdgeWithHysteresis`) and
 * does not oscillate as the live window advances in segment-sized steps. Defaults to `true`
 * (fresh state is assumed live) so first-call behavior is unchanged.
 */
export function computeLiveDVRState(
  element: HTMLMediaElement | null,
  config: LiveDVRConfig = {},
  previousAtEdge = true,
): LiveDVRState {
  const empty: LiveDVRState = {
    hasDVR: false,
    seekableStart: 0,
    seekableEnd: 0,
    seekableWindow: 0,
    isAtLiveEdge: true,
    liveEdgeOffset: 0,
    sliderDuration: 0,
    sliderPosition: 0,
  };

  if (!element) return empty;

  const seekable = element.seekable;
  if (!seekable || seekable.length === 0) return empty;

  // Use the last seekable range (most relevant for live). All at-edge/offset/window math
  // (including hysteresis) is delegated to the shared `computeDVRFromRange` so the element path
  // and the adapter/controller path stay in sync.
  const seekableStart = seekable.start(seekable.length - 1);
  const seekableEnd = seekable.end(seekable.length - 1);

  return computeDVRFromRange(seekableStart, seekableEnd, element.currentTime, config, previousAtEdge);
}

/**
 * Pure DVR-state computation from a raw seekable range + current time. Shared by
 * `computeLiveDVRState` (which reads them off an `HTMLMediaElement`) and the `LiveDVRController`
 * (which reads them off an injected `DVRAdapter`), so the at-edge/offset/window math — including
 * the hysteresis — lives in ONE place (no duplication between the element path and the adapter
 * path). Applies the same min-window guard and hysteresis-based edge detection.
 */
export function computeDVRFromRange(
  seekableStart: number,
  seekableEnd: number,
  currentTime: number,
  config: LiveDVRConfig = {},
  previousAtEdge = true,
): LiveDVRState {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const { minDVRWindow, liveEdgeTolerance } = merged;
  const hysteresis = merged.liveEdgeHysteresis ?? DEFAULT_HYSTERESIS;
  const seekableWindow = seekableEnd - seekableStart;

  if (seekableWindow < minDVRWindow || !isFinite(seekableWindow)) {
    return {
      hasDVR: false,
      seekableStart,
      seekableEnd,
      seekableWindow,
      isAtLiveEdge: true,
      liveEdgeOffset: 0,
      sliderDuration: 0,
      sliderPosition: 0,
    };
  }

  const rawOffset = currentTime - seekableEnd; // Negative when behind
  const isAtLiveEdge = isAtLiveEdgeWithHysteresis(rawOffset, liveEdgeTolerance, hysteresis, previousAtEdge);
  const sliderDuration = seekableWindow;

  // At the live edge, PIN the presentation to the bleeding edge (YouTube-style): the offset reads
  // as 0 (the badge shows just "Live", no timer) and the slider thumb sits flush at the end. A
  // live stream's `seekableEnd` advances in segment-sized steps while `currentTime` climbs at 1×,
  // so the true `currentTime - seekableEnd` sits a few seconds behind and jitters (-5,-6,-7…) —
  // presenting that raw value made the timeline/timer look permanently out of sync even while
  // watching live. Behind the edge, the real offset/position drive the DVR read-out.
  const liveEdgeOffset = isAtLiveEdge ? 0 : rawOffset;
  const sliderPosition = isAtLiveEdge
    ? sliderDuration
    : Math.max(0, Math.min(currentTime - seekableStart, seekableWindow));

  return {
    hasDVR: true,
    seekableStart,
    seekableEnd,
    seekableWindow,
    isAtLiveEdge,
    liveEdgeOffset,
    sliderDuration,
    sliderPosition,
  };
}

/**
 * The safe margin (seconds) BEHIND the live edge that "jump to live" targets. Seeking exactly to
 * `seekableEnd` (or `end - 1`) leaves almost no headroom: the live window keeps advancing in
 * segment steps, so a 1s cushion is immediately swallowed and the offset drifts. Landing a few
 * seconds back keeps playback comfortably inside the at-edge band (and, for VOD-as-live, avoids
 * firing `ended`). This is the standard "live latency" cushion players keep from the bleeding edge.
 */
export const LIVE_EDGE_SEEK_MARGIN = 3;

/**
 * Resolve the absolute time "jump to live" should seek to for a given seekable range: a few
 * seconds behind the live edge (`LIVE_EDGE_SEEK_MARGIN`), clamped to the window start so a
 * sub-margin window still yields a valid time.
 */
export function liveEdgeSeekTarget(seekableStart: number, seekableEnd: number): number {
  return Math.max(seekableStart, seekableEnd - LIVE_EDGE_SEEK_MARGIN);
}

/**
 * Convert a slider position (0..seekableWindow) back to an absolute seek time.
 */
export function sliderPositionToTime(position: number, seekableStart: number): number {
  return seekableStart + position;
}

/**
 * Default jitter step (seconds) for `stabilizeLiveOffset`. Roughly one HLS/DASH segment: the
 * live window's `seekableEnd` extends in ~2s segment steps while `currentTime` advances smoothly,
 * so the raw behind-live offset (`currentTime - seekableEnd`) wobbles within ~one segment.
 */
export const LIVE_OFFSET_STABILIZE_STEP = 2;

/**
 * Stabilize the behind-live offset READOUT so it does not flicker (e.g. `-1:00 ↔ -1:01`) while
 * playing in the past. When you play the DVR window at 1× your distance to the live edge is
 * essentially CONSTANT (both `currentTime` and `seekableEnd` advance at the same wall-clock rate),
 * but `seekableEnd` jumps in discrete segment steps, so the raw offset jitters by up to ~one
 * segment. This keeps the previously shown offset unless the new offset moved by MORE than `step`,
 * so a genuine seek/drift updates the number while segment-step noise does not (YouTube-style
 * stable readout). `previousOffset` is the last stabilized value (0 when none yet).
 */
export function stabilizeLiveOffset(rawOffset: number, previousOffset = 0, step = LIVE_OFFSET_STABILIZE_STEP): number {
  if (previousOffset === 0) return rawOffset;
  return Math.abs(rawOffset - previousOffset) > step ? rawOffset : previousOffset;
}

/**
 * Format a live edge offset as a display string.
 * Returns "LIVE" if at edge, or a negative time string like "-1:20:06".
 */
export function formatLiveOffset(offsetSeconds: number, isAtLiveEdge: boolean): string {
  if (isAtLiveEdge) return '';

  const absSeconds = Math.abs(Math.round(offsetSeconds));
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `-${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `-${minutes}:${pad(seconds)}`;
}
