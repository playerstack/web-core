/**
 * Browser and environment detection constants.
 */
export const HAS_NAVIGATOR = typeof navigator !== 'undefined';
export const IS_IPAD_PRO = HAS_NAVIGATOR && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
export const IS_IOS =
  HAS_NAVIGATOR && (/iPad|iPhone|iPod/.test(navigator.userAgent) || IS_IPAD_PRO) && !(window as any)['MSStream'];
export const IS_SAFARI =
  HAS_NAVIGATOR && /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !(window as any)['MSStream'];

/**
 * Whether the platform exposes an MSE-class API usable by hls.js.
 *
 * `MediaSource` covers desktop browsers, Android and iPadOS 13+. `ManagedMediaSource`
 * (Apple, shipped in Safari 17.1 / iOS 17.1, Nov 2023) is the FIRST time MSE-class
 * functionality exists on iPhone Safari. When present, hls.js can build its own buffer
 * and expose a real `seekable` window — which is what makes live-DVR seek-back work on
 * iPhone (the native HLS engine never exposes a seekable DVR window; it pins to the live
 * edge). Without it (iOS < 17.1) hls.js cannot run on iPhone and native HLS is the only
 * option.
 */
export const IS_MMS_SUPPORTED =
  (typeof self !== 'undefined' &&
    ('ManagedMediaSource' in self || 'MediaSource' in self || 'WebKitMediaSource' in self)) ||
  false;

/**
 * Whether the platform can actually time-shift a live stream (live-DVR seek-back).
 *
 * DVR seek needs an MSE-class engine (hls.js) that exposes its own seekable window. On iOS that
 * requires ManagedMediaSource (iOS 17.1+); iOS < 17.1 falls back to native HLS, which pins to the
 * live edge and never exposes a seekable DVR range. Everywhere else DVR is available. Skins use
 * this to DEGRADE a `liveDVR` stream to a plain live stream (LIVE badge, no timeline) when the
 * platform can't seek — instead of showing a dead timeline that won't scrub.
 */
export const IS_LIVE_DVR_SUPPORTED = !(IS_IOS && !IS_MMS_SUPPORTED);

/**
 * External SDK CDN URLs.
 * VERSION placeholder is replaced at runtime with the configured version.
 */
export const HLS_SDK_URL = 'https://cdn.jsdelivr.net/npm/hls.js@VERSION/dist/hls.min.js';
export const HLS_GLOBAL = 'Hls';

export const DASH_SDK_URL = 'https://cdnjs.cloudflare.com/ajax/libs/dashjs/VERSION/dash.all.min.js';
export const DASH_GLOBAL = 'dashjs';

export const FLV_SDK_URL = 'https://cdn.jsdelivr.net/npm/flv.js@VERSION/dist/flv.min.js';
export const FLV_GLOBAL = 'flvjs';

/**
 * Default SDK versions.
 */
export const DEFAULT_HLS_VERSION = '1.5.7';
export const DEFAULT_DASH_VERSION = '4.7.4';
export const DEFAULT_FLV_VERSION = '1.6.2';

/**
 * Default progress polling interval in milliseconds.
 */
export const DEFAULT_PROGRESS_INTERVAL = 1000;

/**
 * Default media configuration shared by all PlayerStack wrappers.
 * Consumers spread this into their defaultProps.config, adding package-specific keys.
 */
export const defaultMediaConfig = {
  forceHLS: false,
  forceDASH: false,
  forceFLV: false,
  hlsOptions: {} as Record<string, unknown>,
  hlsVersion: DEFAULT_HLS_VERSION,
  dashVersion: DEFAULT_DASH_VERSION,
  flvVersion: DEFAULT_FLV_VERSION,
  forceDisableHls: false,
} as const;
