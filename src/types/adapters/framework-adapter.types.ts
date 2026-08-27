/**
 * Framework-agnostic adapter contract used to synchronize props/attributes and
 * subscribe to request events on a `playerstack-*` Custom Element. Both the
 * React_Adapter and a future Vue_Adapter build on this same contract so every
 * framework exposes the same features without framework-specific logic (Req 8.1,
 * 8.2, 8.3).
 *
 * @typeParam E - The concrete Custom Element type the adapter operates on.
 */
export interface FrameworkAdapterContract<E extends HTMLElement = HTMLElement> {
  /** Reflects a value onto the element as an HTML attribute. */
  syncAttribute(el: E, name: string, value: string | number | boolean | null): void;
  /** Assigns a value to the element as a JavaScript property. */
  syncProperty(el: E, name: string, value: unknown): void;
  /** Subscribes to a DOM event on the element; returns an unsubscribe function. */
  subscribe(el: E, eventName: string, handler: (ev: Event) => void): () => void;
}

/**
 * Describes a single UI_Element binding: the Custom Element tag, the attributes
 * it accepts, and the request events it emits. The full set of bindings covers
 * every UI_Element of the UI_Layer so adapters can traverse the same table
 * (Req 8.4).
 */
export interface UiElementBinding {
  /** The Custom Element tag name, always prefixed with `playerstack-`. */
  tagName: `playerstack-${string}`;
  /** The attribute names the element observes. */
  attributes: readonly string[];
  /** The request event names the element dispatches. */
  requestEvents: readonly string[];
}
