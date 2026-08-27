import type { MediaEngineConfig } from '@typings/media.types';
import type { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';

/**
 * Configuration accepted by the Vanilla_Build `initPlayer` entry (Req 6.1, 6.2).
 *
 * Kept as a named type (not inline) so the Vanilla_Build entry and any consumer share a
 * single source of truth for the mount options. All fields are optional so a bare
 * `initPlayer(container)` mounts an empty-but-functional player the consumer can drive
 * later through the returned instance.
 */
export interface InitPlayerConfig {
  /** Optional media source URL loaded immediately after the player is wired. */
  url?: string;
  /** When true, the underlying `HTMLMediaElement` is an `<audio>` instead of a `<video>`. */
  audio?: boolean;
  /** Options forwarded to the `MediaEngine` (SDK versions, force flags, live mode, etc.). */
  engine?: MediaEngineConfig;
}

/**
 * Handle returned by `initPlayer` so a framework-less consumer can observe and tear down
 * the mounted player without reaching into Core internals (Req 6.2).
 *
 * WHY a `destroy` handle: the Vanilla_Build owns the orchestrator, the media element and
 * the host element it created; exposing an explicit teardown lets the consumer release
 * those resources (listeners, timers, SDKs) deterministically when the player is removed.
 */
export interface PlayerInstance {
  /** The root `playerstack-media-controller` host element appended into the container. */
  controller: PlayerstackMediaController;
  /** The underlying native media element the engine drives. */
  element: HTMLMediaElement;
  /** Tears down the orchestrator/engine and removes the created elements from the DOM. */
  destroy(): void;
}
