/**
 * Media context provide/consume built on the DOM "context request event" pattern
 * (as used by Media Chrome and the community Context Protocol). Descendant
 * `playerstack-*` elements obtain the shared `MediaContext` (the `MediaStore`) from their
 * root host WITHOUT holding direct references to it (Req 2.2, 2.3).
 *
 * How it works: a consumer dispatches a bubbling + composed `CustomEvent` carrying a
 * `callback`. The nearest provider (the root host) listens for that event, calls the
 * callback with the context value, and stops propagation so it wins over any ancestor
 * provider. If no provider responds synchronously, the callback is simply never called
 * and the consumer can retry when it (re)connects.
 */
import type { MediaContext, MediaContextRequestDetail } from '@typings/ui/media-context.types';

/**
 * Name of the DOM event used to request the media context. Prefixed with `playerstack-`
 * to stay consistent with the request events emitted by the UI_Layer.
 */
export const MEDIA_CONTEXT_EVENT = 'playerstack-context-request';

/**
 * Consumer side: ask the nearest ancestor provider for the shared media context.
 *
 * The event is `bubbles: true` + `composed: true` so it can climb out of the consumer's
 * shadow root and cross shadow boundaries until it reaches the provider host. Because a
 * conformant provider invokes the callback synchronously during dispatch, the callback
 * runs (if a provider exists) before `dispatchEvent` returns. When no provider handles
 * the event, the callback is never invoked — the consumer can retry on its next connect.
 */
export function requestMediaContext(consumer: EventTarget, callback: (context: MediaContext) => void): void {
  const detail: MediaContextRequestDetail = { callback };
  consumer.dispatchEvent(new CustomEvent(MEDIA_CONTEXT_EVENT, { detail, bubbles: true, composed: true }));
}

/**
 * Provider side: expose `context` to descendants that request it. Registers a listener
 * for `MEDIA_CONTEXT_EVENT` on `provider`; on each request it hands the context to the
 * consumer's callback and calls `stopPropagation()` so the NEAREST provider wins (the
 * event never reaches an outer provider up the tree).
 *
 * Returns an unsubscribe function that removes the listener, so the provider can clean up
 * deterministically when it disconnects.
 */
export function provideMediaContext(provider: EventTarget, context: MediaContext): () => void {
  const handler = (event: Event): void => {
    // The event is always dispatched as a CustomEvent carrying the request detail; casting
    // to the concrete type keeps access to `detail.callback` typed without `any`.
    const { detail } = event as CustomEvent<MediaContextRequestDetail>;
    detail.callback(context);
    // Nearest provider wins: stop the request from reaching an ancestor provider.
    event.stopPropagation();
  };

  provider.addEventListener(MEDIA_CONTEXT_EVENT, handler);
  return () => {
    provider.removeEventListener(MEDIA_CONTEXT_EVENT, handler);
  };
}
