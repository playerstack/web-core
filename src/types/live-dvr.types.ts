export interface LiveDVRState {
  /** Whether the stream has a usable DVR window (seekable range > minWindow) */
  hasDVR: boolean;
  /** Start of the seekable range in seconds */
  seekableStart: number;
  /** End of the seekable range in seconds (the live edge) */
  seekableEnd: number;
  /** Total length of the seekable window in seconds */
  seekableWindow: number;
  /** Whether the current playback position is at/near the live edge */
  isAtLiveEdge: boolean;
  /** Offset from live edge in seconds (negative value, e.g. -80 means 80s behind) */
  liveEdgeOffset: number;
  /** Duration value to use for the slider (seekableWindow) */
  sliderDuration: number;
  /** Current position within the slider (0 to sliderDuration) */
  sliderPosition: number;
}

export interface LiveDVRConfig {
  /**
   * Minimum seekable window in seconds before DVR is considered available.
   * Streams with a shorter window won't show a timeline.
   * @default 15
   */
  minDVRWindow?: number;
  /**
   * Tolerance in seconds for "at live edge" detection (the ENTER threshold).
   * If currentTime is within this many seconds of seekableEnd, consider at edge.
   * Generous by default so a live stream's segment-stepped `seekableEnd` does not read as
   * "behind live" while the viewer is watching the edge.
   * @default 18
   */
  liveEdgeTolerance?: number;
  /**
   * Extra seconds added to the tolerance before the "at live edge" flag is allowed to DROP once
   * set (hysteresis / Schmitt-trigger exit band). Prevents the badge from flickering between
   * live/behind as `seekableEnd` advances in discrete segment steps.
   * @default 12
   */
  liveEdgeHysteresis?: number;
}
