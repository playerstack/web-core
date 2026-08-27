/**
 * Initial player state contract shared across all PlayerStack wrappers.
 */
export const playerStateInitial = {
  kernelError: null as any,
  seeking: false,
  seek: 0,
  played: 0,
  loaded: 0,
  bufferedRanges: [] as Array<{ start: number; end: number }>,
  duration: 0,
  isFullScreen: false,
  isEnded: false,
  isPIP: false,
  isLoading: true,
  isBuffering: false,
  volume: 0.8,
  playbackRate: 1,
  playbackQuality: null as number | null,
  videoUrl: null as string | null,
  hasAudio: true,
  loop: false,
  playing: false,
  isMuted: false,
  activeCaption: null as string | null,
};

export type PlayerState = typeof playerStateInitial;

/**
 * Audio player initial state — subset of playerStateInitial without
 * fullscreen, PiP, quality, captions, and video-specific fields.
 */
export const audioPlayerStateInitial = {
  kernelError: playerStateInitial.kernelError,
  seeking: playerStateInitial.seeking,
  seek: playerStateInitial.seek,
  played: playerStateInitial.played,
  loaded: playerStateInitial.loaded,
  duration: playerStateInitial.duration,
  isEnded: playerStateInitial.isEnded,
  isLoading: playerStateInitial.isLoading,
  isBuffering: playerStateInitial.isBuffering,
  volume: playerStateInitial.volume,
  playbackRate: playerStateInitial.playbackRate,
  hasAudio: playerStateInitial.hasAudio,
  loop: playerStateInitial.loop,
  playing: playerStateInitial.playing,
  isMuted: playerStateInitial.isMuted,
};

export type AudioPlayerState = typeof audioPlayerStateInitial;

/**
 * Computes the next player state on a seek transition.
 *
 * While seeking, the "ended" overlay is cleared so the user sees the frame
 * they are scrubbing to. When the seek is released, playback always resumes
 * from the new position, regardless of whether the player was paused or ended.
 */
export const reduceSeekState = (prev: PlayerState, seeking: boolean): PlayerState => ({
  ...prev,
  seeking,
  isEnded: false,
  playing: seeking ? prev.playing : true,
});
