import { createTypedReducer } from '@reducer';

describe('createTypedReducer', () => {
  const validTypes = ['volume', 'playing', 'muted'] as const;
  const reducer = createTypedReducer<{ volume: number; playing: boolean; muted: boolean }>(validTypes);

  const initial = { volume: 0.8, playing: false, muted: false };

  test('returns state unchanged for null action', () => {
    expect(reducer(initial, null)).toBe(initial);
  });

  test('handles typed action { type, payload }', () => {
    const result = reducer(initial, { type: 'volume', payload: 0.5 });
    expect(result.volume).toBe(0.5);
    expect(result.playing).toBe(false); // unchanged
  });

  test('bails out if value unchanged', () => {
    const result = reducer(initial, { type: 'volume', payload: 0.8 });
    expect(result).toBe(initial); // same reference
  });

  test('throws for invalid type', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const result = reducer(initial, { type: 'invalid', payload: true });
    expect(result).toBe(initial); // returns unchanged state on error
    consoleSpy.mockRestore();
  });

  test('handles object merge action', () => {
    const result = reducer(initial, { volume: 0.3, playing: true });
    expect(result.volume).toBe(0.3);
    expect(result.playing).toBe(true);
    expect(result.muted).toBe(false);
  });

  test('returns same reference for object merge with no changes', () => {
    const result = reducer(initial, { volume: 0.8, playing: false });
    expect(result).toBe(initial);
  });

  test('throws for empty object action', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const result = reducer(initial, {});
    expect(result).toBe(initial);
    consoleSpy.mockRestore();
  });

  test('handles function action', () => {
    const result = reducer(initial, (state: typeof initial) => ({ type: 'playing', payload: !state.playing }));
    expect(result.playing).toBe(true);
  });

  test('returns state for function action returning null', () => {
    const result = reducer(initial, () => null);
    expect(result).toBe(initial);
  });

  test('returns state for function action returning non-object', () => {
    const result = reducer(initial, () => 'invalid');
    expect(result).toBe(initial);
  });
});
