import { createMediaStore } from '@ui/media-store';
import { playerStateInitial } from '@player-state';

describe('createMediaStore', () => {
  test('getState returns the default playerStateInitial when no initial is given', () => {
    const store = createMediaStore();
    expect(store.getState()).toEqual(playerStateInitial);
  });

  test('merges the initial override on top of playerStateInitial', () => {
    const store = createMediaStore({ playing: true });
    const state = store.getState();
    expect(state.playing).toBe(true);
    // Other fields keep their defaults.
    expect(state.volume).toBe(playerStateInitial.volume);
    expect(state.isLoading).toBe(playerStateInitial.isLoading);
  });

  test('subscribe receives the merged state on set (partial merge)', () => {
    const store = createMediaStore();
    const listener = jest.fn();
    store.subscribe(listener);

    store.set({ volume: 0.5 });

    expect(listener).toHaveBeenCalledTimes(1);
    const received = listener.mock.calls[0][0];
    expect(received.volume).toBe(0.5);
    // Prior fields remain intact after the partial merge.
    expect(received.playing).toBe(playerStateInitial.playing);
    expect(received.isLoading).toBe(playerStateInitial.isLoading);
  });

  test('notifies all subscribers on set', () => {
    const store = createMediaStore();
    const first = jest.fn();
    const second = jest.fn();
    store.subscribe(first);
    store.subscribe(second);

    store.set({ playing: true });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0].playing).toBe(true);
    expect(second.mock.calls[0][0].playing).toBe(true);
  });

  test('unsubscribe stops further notifications to that listener', () => {
    const store = createMediaStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ playing: true });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set({ volume: 0.3 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('set produces a new state object without mutating prior snapshots', () => {
    const store = createMediaStore();
    const a = store.getState();

    store.set({ playing: true });

    expect(store.getState()).not.toBe(a);
    // The old snapshot is left untouched.
    expect(a.playing).toBe(false);
    expect(store.getState().playing).toBe(true);
  });

  test('a listener unsubscribing during notification does not break others', () => {
    const store = createMediaStore();
    const second = jest.fn();
    let unsubscribeFirst: () => void = () => {};
    const first = jest.fn(() => {
      unsubscribeFirst();
    });

    unsubscribeFirst = store.subscribe(first);
    store.subscribe(second);

    expect(() => store.set({ playing: true })).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
