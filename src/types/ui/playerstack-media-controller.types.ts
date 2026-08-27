import type { PlayerAdapter } from '@typings/adapters.types';
import type { PlayerOrchestrator } from '@player-orchestrator';

/**
 * Named `part`s exposed by the `playerstack-media-controller` root host so Skins can
 * style its internal structure through the Shadow DOM boundary (Req 5.1, 5.3). Kept as a
 * named type (not inline) so the element's markup and any tests share one source of truth
 * for the Markup_Contract.
 */
export type MediaControllerPart = 'root' | 'media' | 'controls';

/**
 * Arguments accepted by `PlayerstackMediaController.attachController` to wire the optional
 * `MediaController` (adapter + orchestrator) into the root host after construction.
 *
 * WHY optional/late wiring: the host creates and provides the reactive `MediaStore` itself
 * so descendants resolve the context immediately, but the concrete `PlayerAdapter` and
 * `PlayerOrchestrator` are built by the Vanilla_Build / framework adapter layer. Exposing
 * them as an explicit attach call keeps the element usable standalone in tests while still
 * being able to host the controller when the adapter layer provides one.
 */
export interface AttachControllerParams {
  /** Provider adapter that performs the actual media I/O (Req 2.2). */
  adapter: PlayerAdapter;
  /** Orchestrator whose playback events feed the shared store (Req 2.3). */
  orchestrator: PlayerOrchestrator;
}
