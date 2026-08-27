import type { PlayerState } from '@player-state';

/**
 * State shape held by the reactive `MediaStore`. Reuses the shared
 * `PlayerState` contract from the player-state module (Req 2.3).
 */
export type MediaStoreState = PlayerState;

/**
 * Listener invoked with the latest immutable store state on every change.
 */
export type MediaStoreListener = (state: Readonly<MediaStoreState>) => void;

/**
 * Reactive store that holds the media state and notifies subscribers when it
 * changes. UI_Elements subscribe to receive state updates (Req 2.3).
 */
export interface MediaStore {
  /** Returns the current immutable state snapshot. */
  getState(): Readonly<MediaStoreState>;
  /** Merges a partial patch into the current state and notifies listeners. */
  set(patch: Partial<MediaStoreState>): void;
  /** Subscribes a listener; returns an unsubscribe function. */
  subscribe(listener: MediaStoreListener): () => void;
}
