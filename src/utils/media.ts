/**
 * Check if a value is a MediaStream instance.
 */
export function isMediaStream(url: unknown): url is MediaStream {
  return (
    typeof window !== 'undefined' && typeof window.MediaStream !== 'undefined' && url instanceof window.MediaStream
  );
}

/**
 * Check if a URL is a blob URL.
 */
export function isBlobUrl(url: string): boolean {
  return /^blob:/.test(url);
}

/**
 * Check if video element has audio tracks.
 */
export function hasAudio(video: HTMLVideoElement): boolean {
  return (
    (video as any)?.mozHasAudio ||
    (video as any)?.webkitAudioDecodedByteCount > 0 ||
    ((video as any)?.audioTracks !== undefined && (video as any).audioTracks.length > 0)
  );
}

/**
 * Check if the video element supports WebKit presentation mode (PiP on Safari).
 */
export function supportsWebKitPresentationMode(video?: HTMLVideoElement | null): boolean {
  const videoElement = video || document.createElement('video');
  const notMobile = /iPhone|iPod/.test(navigator.userAgent) === false;
  return (
    (videoElement as any).webkitSupportsPresentationMode &&
    typeof (videoElement as any).webkitSetPresentationMode === 'function' &&
    notMobile
  );
}
