import { isMediaStream, isBlobUrl } from '@utils/media';

/**
 * File extension patterns for detecting media format.
 */
export const VIDEO_EXTENSIONS = /\.(mp4|og[gv]|webm|mov|m4v)(#t=[,\d+]+)?($|\?)/i;
export const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|aac|ogg|m4a|opus|wma)(#t=[,\d+]+)?($|\?)/i;
export const HLS_EXTENSIONS = /\.(m3u8)($|\?)/i;
export const DASH_EXTENSIONS = /\.(mpd)($|\?)/i;
export const FLV_EXTENSIONS = /\.(flv)($|\?)/i;

/**
 * Determine if a URL points to an audio file.
 */
export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return AUDIO_EXTENSIONS.test(url);
}

/**
 * Determine if a URL/source can be played by the engine.
 */
export function canPlay(url: string | MediaStream | null | undefined, sources?: Array<{ src: string }>): boolean {
  if (sources && sources.length > 0) {
    return true;
  }

  if (!url) return false;

  if (isMediaStream(url) || isBlobUrl(url as string)) {
    return true;
  }

  const urlStr = url as string;
  return (
    VIDEO_EXTENSIONS.test(urlStr) ||
    AUDIO_EXTENSIONS.test(urlStr) ||
    HLS_EXTENSIONS.test(urlStr) ||
    DASH_EXTENSIONS.test(urlStr) ||
    FLV_EXTENSIONS.test(urlStr)
  );
}
