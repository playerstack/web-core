/**
 * Slider math utilities for time sliders and volume sliders.
 * Pure geometry calculations — no framework dependency.
 */

/**
 * Extract X coordinate from a mouse or touch event-like object.
 */
export function getEventXCoordinate(event: { clientX?: number; changedTouches?: { pageX: number }[] }): number {
  if (event.changedTouches && event.changedTouches.length >= 1) {
    return event.changedTouches[0]!.pageX;
  }
  return event.clientX || 0;
}

/**
 * Clamp an element's position within a slider's bounds.
 */
export function getClampedPosition({
  duration,
  currentTime,
  sliderWidth,
  elementWidth,
  offset = 0,
}: {
  duration: number;
  currentTime: number;
  sliderWidth: number;
  elementWidth: number;
  offset?: number;
}): number {
  if (duration <= 0 || sliderWidth <= 0 || elementWidth <= 0) {
    return 0;
  }
  const relativePosition = (currentTime / duration) * sliderWidth;
  const halfWidth = elementWidth / 2;
  const minPosition = halfWidth + offset;
  const maxPosition = sliderWidth - halfWidth - offset;
  return Math.min(maxPosition, Math.max(minPosition, relativePosition));
}

/**
 * Convert a pointer X position on a slider into a time value.
 */
export function getTimeFromSliderPosition(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
): number {
  const w = clientX - rect.left;
  if (w <= 0) return 0;
  if (w >= rect.width) return duration;
  return Math.round((duration * w) / rect.width);
}

/**
 * Calculate CSS translateX percentages for slider track and handle.
 */
export function getTrackTranslateX({
  duration,
  currentTime,
  sliderWidth,
  handleWidth,
}: {
  duration: number;
  currentTime: number;
  sliderWidth: number;
  handleWidth: number;
}): { trackTranslateX: string; handleTranslateX: string } {
  if (duration === 0) {
    return { trackTranslateX: '-100', handleTranslateX: '-100' };
  }

  const clampedPosition = getClampedPosition({
    duration,
    currentTime,
    sliderWidth,
    elementWidth: handleWidth,
    offset: 0,
  });

  const trackTranslateX = ((100 * currentTime) / duration - 100).toFixed(1);
  const handleTranslateX = ((clampedPosition / sliderWidth) * 100 - 100).toFixed(1);

  return { trackTranslateX, handleTranslateX };
}

/**
 * Calculate tooltip translateX percentage clamped within slider bounds.
 */
export function getMouseTranslateX({
  duration,
  currentTime,
  sliderWidth,
  tooltipWidth,
}: {
  duration: number;
  currentTime: number;
  sliderWidth: number;
  tooltipWidth: number;
}): string {
  const clampedPosition = getClampedPosition({
    duration,
    currentTime,
    sliderWidth,
    elementWidth: tooltipWidth,
    offset: 5,
  });

  return ((clampedPosition / sliderWidth) * 100).toFixed(1);
}

/**
 * Calculate volume percentage from pointer X position on a slider.
 */
export function getVolumePercentage(offsetX: number, trackWidth: number): number {
  let percentage = (offsetX / trackWidth) * 100;
  if (percentage < 0) percentage = 0;
  if (percentage > 100) percentage = 100;
  return percentage;
}

/**
 * Fill origin for the volume slider — WHICH end of the track represents FULL volume.
 *
 * `'start'` (default): louder = fill/thumb toward the RIGHT; the conventional left-to-right
 * slider (video skin).
 *
 * `'end'`: louder = fill/thumb toward the LEFT; the RIGHT end (nearest the mute icon in the
 * audio skin's reversed layout) is silence. Reproduces the original audio slider by DESIGN:
 * raising volume grows the bar from the icon side leftward, and dragging TOWARD the icon lowers
 * it. A geometry decision, not a reading-direction/RTL concern.
 */
export type VolumeFillOrigin = 'start' | 'end';

/**
 * Pure geometry for painting the volume slider. Given the real `volume` (0..1), the `muted`
 * flag and the fill `origin`, returns the fill width and thumb position as track percentages:
 *
 *   - Both `fillPercent` and `thumbPercent` follow the EFFECTIVE volume (0 while muted), so
 *     muting drains the bar and moves the thumb to the silence end.
 *   - For `'end'` the THUMB is mirrored (`100 - pct`): full volume at the LEFT, silence at the
 *     RIGHT (icon side) — so muting rests the thumb next to the icon. The FILL is anchored to
 *     the right edge by the element (CSS); its width equals the effective percentage.
 *
 * No DOM, no framework. Both values clamp to `0..100`.
 */
export function getVolumeFillGeometry({
  volume,
  muted,
  origin = 'start',
}: {
  volume: number;
  muted: boolean;
  origin?: VolumeFillOrigin;
}): { fillPercent: number; thumbPercent: number } {
  // Both the fill and the thumb follow the EFFECTIVE volume (0 while muted), so muting drains
  // the bar AND rests the thumb at the silence end — for `end` that silence end is the RIGHT
  // (icon side), matching the original audio slider (`thumb right = 6 + effectiveVolume*68`).
  const effective = muted ? 0 : volume;
  const pct = getVolumePercentage(effective * 100, 100);
  const thumbPercent = origin === 'end' ? 100 - pct : pct;
  return { fillPercent: pct, thumbPercent };
}

/**
 * Pure conversion of a pointer X (relative to the track's left) into a 0..1 volume, honoring
 * the fill origin. `'start'`: left edge = 0, right edge = max. `'end'`: inverted, so dragging
 * toward the icon (right) lowers volume and toward the left raises it. `trackWidth <= 0` → 0.
 */
export function getVolumeFromPointer(offsetX: number, trackWidth: number, origin: VolumeFillOrigin = 'start'): number {
  if (trackWidth <= 0) return 0;
  const pct = getVolumePercentage(offsetX, trackWidth);
  const value = origin === 'end' ? 100 - pct : pct;
  return value / 100;
}
