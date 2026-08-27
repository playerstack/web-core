import type { MediaStore } from '@typings/ui/media-store.types';

/**
 * The shared media context provided by the root host (`playerstack-media-controller`)
 * and consumed by descendant `playerstack-*` elements (Req 2.2, 2.3).
 *
 * WHY minimal: consumers only need the reactive `MediaStore` to subscribe to state and
 * (indirectly) to dispatch request events. The controller can extend this later without
 * forcing every consumer to change — keeping the surface small avoids premature coupling.
 */
export interface MediaContext {
  /** The reactive store descendants subscribe to for state updates. */
  store: MediaStore;
}

/**
 * Detail payload carried by the context-request `CustomEvent`. The consumer passes a
 * `callback` that the nearest provider invokes synchronously with the shared context.
 */
export interface MediaContextRequestDetail {
  callback: (context: MediaContext) => void;
}
