/**
 * Types for the `playerstack-live-ad` UI_Element — the Twitch-style live-stream ad break overlay.
 *
 * The element owns a headless `LiveAdController` (the phase machine) and renders the overlay
 * markup + the ad `<video>`. Stream-side I/O (mute/restore/suppress-pause of the real live
 * `<video>`, and opening the CTA URL) is supplied by an injected `LiveAdAdapter`.
 */

/** Named Shadow DOM `part`s exposed for styling through the shadow boundary. */
export type LiveAdPart =
  | 'live-ad'
  | 'live-ad-video'
  | 'live-ad-top-bar'
  | 'live-ad-badge'
  | 'live-ad-info'
  | 'live-ad-bottom-bar'
  | 'live-ad-actions'
  | 'live-ad-stream-badge'
  | 'live-ad-cta'
  | 'live-ad-skip'
  | 'live-ad-progress'
  | 'live-ad-progress-bar';
