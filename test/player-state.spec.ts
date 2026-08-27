import { playerStateInitial, reduceSeekState } from '@player-state';

describe('playerStateInitial', () => {
  test('has expected default values', () => {
    expect(playerStateInitial.playing).toBe(false);
    expect(playerStateInitial.volume).toBe(0.8);
    expect(playerStateInitial.playbackRate).toBe(1);
    expect(playerStateInitial.isLoading).toBe(true);
    expect(playerStateInitial.isBuffering).toBe(false);
    expect(playerStateInitial.isEnded).toBe(false);
    expect(playerStateInitial.seeking).toBe(false);
    expect(playerStateInitial.duration).toBe(0);
    expect(playerStateInitial.isMuted).toBe(false);
    expect(playerStateInitial.kernelError).toBeNull();
  });
});

describe('reduceSeekState', () => {
  test('sets seeking to true and clears isEnded', () => {
    const prev = { ...playerStateInitial, isEnded: true, playing: false };
    const result = reduceSeekState(prev, true);
    expect(result.seeking).toBe(true);
    expect(result.isEnded).toBe(false);
    expect(result.playing).toBe(false); // Preserves playing during seek
  });

  test('sets seeking to false and resumes playing', () => {
    const prev = { ...playerStateInitial, seeking: true, playing: false };
    const result = reduceSeekState(prev, false);
    expect(result.seeking).toBe(false);
    expect(result.playing).toBe(true); // Resumes on release
  });

  test('preserves playing state during seek start', () => {
    const prev = { ...playerStateInitial, playing: true };
    const result = reduceSeekState(prev, true);
    expect(result.playing).toBe(true);
  });
});
