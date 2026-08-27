/**
 * Reactive `MediaStore` that holds the media state and notifies subscribers whenever it
 * changes (Req 2.3). The store shape reuses the shared `PlayerState` contract via
 * `MediaStoreState`, so the UI_Layer and the headless player state can never drift apart.
 *
 * This module owns only the reactive plumbing — no DOM access and no player logic. The
 * `MediaController` drives it (`store.set`) from the orchestrator's `EventEmitter`, and
 * UI_Elements `subscribe` to reflect state to `data-*` attributes.
 */
import type { MediaStore, MediaStoreState, MediaStoreListener } from '@typings/ui/media-store.types';
import { playerStateInitial } from '@player-state';

/**
 * Creates a reactive `MediaStore`. The default initial state is the shared
 * `playerStateInitial`; any `initial` override is merged on top so callers can seed the
 * store with a partial state (e.g. audio-only defaults) without restating every field.
 *
 * WHY a factory returning a plain object (rather than a class): it keeps the store simple
 * and idiomatic, closes over the mutable `state`/`listeners` refs privately, and lets the
 * returned value implement the `MediaStore` interface directly.
 */
export function createMediaStore(initial?: Partial<MediaStoreState>): MediaStore {
  // Internal state reference. `set` never mutates it in place; it always swaps in a new
  // object so every snapshot handed to `getState`/listeners is immutable from their view.
  let state: MediaStoreState = { ...playerStateInitial, ...initial };

  // Set of subscribed listeners. A Set gives O(1) add/remove and de-duplicates listeners.
  const listeners = new Set<MediaStoreListener>();

  return {
    getState(): Readonly<MediaStoreState> {
      return state;
    },

    set(patch: Partial<MediaStoreState>): void {
      // Merge the partial patch into a brand-new state object and replace the internal
      // reference, so previously handed-out snapshots stay unchanged.
      state = { ...state, ...patch };

      // Notify a COPY of the listener set: this way a listener that unsubscribes (or
      // subscribes) during notification cannot corrupt the iteration in progress.
      for (const listener of [...listeners]) {
        listener(state);
      }
    },

    subscribe(listener: MediaStoreListener): () => void {
      listeners.add(listener);
      // Return an unsubscribe function that removes exactly this listener.
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
