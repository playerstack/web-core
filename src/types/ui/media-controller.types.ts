import type { PlayerAdapter } from '@typings/adapters.types';
import type { MediaStore } from '@typings/ui/media-store.types';
import type { PlayerOrchestrator } from '@player-orchestrator';
import type { PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';

/**
 * Configuration for constructing a `MediaController` that wires request events
 * from `rootTarget` to `adapter` and propagates state through `store`.
 */
export interface MediaControllerConfig {
  /** Provider adapter that performs the actual media I/O (Req 2.2). */
  adapter: PlayerAdapter;
  /** Reactive store the controller updates as playback state changes. */
  store: MediaStore;
  /** Root host element on which request events are captured. */
  rootTarget: HTMLElement;
  /**
   * Orchestrator whose `EventEmitter` playback events feed the store. The
   * controller subscribes to it so playback state flows back into the reactive
   * store (Req 2.3) — the adapter drives the engine, the orchestrator reports
   * the resulting state, and the controller mirrors that state into `store`.
   */
  orchestrator: PlayerOrchestrator;
}

/**
 * Union of DOM request event names emitted by interactive UI_Elements and
 * routed by the `MediaController` to the `PlayerAdapter` (Req 2.1, 2.2).
 */
export type RequestEventName =
  | 'playerstack-play-request'
  | 'playerstack-pause-request'
  | 'playerstack-seek-request'
  | 'playerstack-volume-request'
  | 'playerstack-mute-request'
  | 'playerstack-unmute-request'
  | 'playerstack-rate-request'
  | 'playerstack-load-request';

/**
 * Detail payload for `playerstack-seek-request`. `time` is an absolute position
 * in seconds; `keepPlaying` preserves the current play state across the seek.
 */
export interface SeekRequestDetail {
  time: number;
  keepPlaying?: boolean;
}

/**
 * Detail payload for `playerstack-scrubbing-request`, emitted by the progress slider WHILE the
 * user drags the handle (before the seek commits on release). `seeking` is `true` on drag start
 * and every drag move, `false` on release; `time` is the current scrub position in seconds. A
 * skin mirrors this into its scrub state so a full-area preview (e.g. the mobile sprite preview)
 * can track the dragged position and show/hide with the drag — without seeking the media on every
 * move. This is intent only; it NEVER touches the media element.
 */
export interface ScrubbingRequestDetail {
  seeking: boolean;
  time: number;
}

/** Detail payload for `playerstack-volume-request`. `volume` is a 0..1 ratio. */
export interface VolumeRequestDetail {
  volume: number;
}

/** Detail payload for `playerstack-rate-request`. `rate` is the playback rate (1 = normal). */
export interface RateRequestDetail {
  rate: number;
}

/**
 * Detail payload for `playerstack-load-request`. `url` is the media source;
 * `isReady` indicates whether immediate playback is expected.
 */
export interface LoadRequestDetail {
  url: string;
  isReady?: boolean;
}

/**
 * Minimal, per-event-typed view of the orchestrator's subscription surface used
 * by the `MediaController`. `PlayerOrchestrator` extends an `EventEmitter` keyed
 * by `PlayerOrchestratorEvents & Record<string, ...>`; that added string index
 * signature would widen `on`/`off` handler parameters when the event key is a
 * union. Referencing the orchestrator through this narrower shape keeps each
 * subscription typed against its exact `PlayerOrchestratorEvents` handler.
 */
export interface OrchestratorEventTarget {
  on<K extends keyof PlayerOrchestratorEvents>(event: K, handler: PlayerOrchestratorEvents[K]): unknown;
  off<K extends keyof PlayerOrchestratorEvents>(event: K, handler: PlayerOrchestratorEvents[K]): unknown;
}
