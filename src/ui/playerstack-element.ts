/**
 * `PlayerstackElement` — the abstract base class for every `playerstack-*` Custom Element
 * (the UI_Layer). It centralizes the shared machinery so individual UI_Elements only
 * describe their attribute schema and their render output (Req 1.1, 1.5, 2.1, 3.3, 3.7).
 *
 * WHY a single base class
 *   Media Chrome and Vidstack both share a base element for the exact reasons captured
 *   here: uniform lifecycle setup, `observedAttributes` derived from a declarative
 *   schema, prop<->attribute reflection through the pure helpers, media-context wiring,
 *   and deterministic teardown. Subclasses stay tiny and never re-implement lifecycle
 *   plumbing.
 *
 * WHY no Shadow DOM (light DOM only)
 *   Every `playerstack-*` element renders into its OWN light DOM (the element itself)
 *   instead of an attached shadow root. The single-`<slot>` + `:host`/`::slotted` model
 *   broke layout and some state selectors, because the composed `playerstack-*` children
 *   were projected through a slot rather than being real descendants. Rendering into the
 *   light DOM makes those children real DOM descendants so ordinary CSS selectors (host
 *   tag + descendant `[part]`) work. The Style_Layer is injected ONCE globally into
 *   `document.head` (see `ensurePlayerstackStyles`) rather than adopted per shadow root,
 *   and Design_Tokens are declared on `:root` (not `:host`).
 *
 * Responsibilities:
 *   - Point `root` at the element itself (light DOM) so `render()` appends the element's
 *     markup directly into the element.
 *   - Derive `observedAttributes` from the static `attributeSchema` (Req 1.1).
 *   - On connect: ensure the global Style_Layer is present in `document.head` exactly once
 *     (Req 3.7), request the shared media context and subscribe to its store, then render.
 *   - On disconnect: run every registered disposer so listeners/subscriptions are cleaned
 *     up deterministically.
 *   - Convert changed attributes back to prop values respecting the declared `type`
 *     (Req 7.2) and expose a `dispatchRequest` helper that emits bubbling + composed
 *     request events (Req 2.1).
 *   - Reflect state to `data-*` on the host through a protected `reflectState` helper
 *     (Req 3.3); the default `onStoreChange` is a no-op subclasses override.
 */
import type { AttributeSchema, MediaContextConsumer } from '@typings/ui/playerstack-element.types';
import type { MediaStoreState, MediaStore } from '@typings/ui/media-store.types';
import type { ReflectableState } from '@typings/styles/state-attributes.types';
import { attributeToProp } from '@ui/attribute-reflect';
import { requestMediaContext } from '@ui/media-context';
import { ensurePlayerstackStyles } from '@styles/style-injector';
import { reflectStateToAttributes } from '@styles/state-attributes';

export abstract class PlayerstackElement extends HTMLElement implements MediaContextConsumer {
  /**
   * Declarative attribute schema. Subclasses override it to declare the attributes they
   * observe and how each maps back to a prop value. Empty by default so a subclass that
   * needs no attributes works without extra boilerplate.
   */
  static attributeSchema: AttributeSchema = {};

  /**
   * `observedAttributes` derived from `attributeSchema` so the schema is the single
   * source of truth (Req 1.1). Access the schema via `this` (the concrete subclass
   * constructor) so each subclass sees its own overridden schema, not the base one.
   */
  static get observedAttributes(): string[] {
    const schema = (this as typeof PlayerstackElement).attributeSchema;
    return Object.keys(schema).map((propKey) => schema[propKey]?.attribute ?? propKey);
  }

  /**
   * Light-DOM render container. There is NO shadow root: `root` is the element itself, so
   * `render()` appends the element's markup directly into its own light DOM. Styles are
   * injected globally into `document.head` (see `connectedCallback`), not per-element.
   */
  protected root: HTMLElement;

  /**
   * The shared reactive store, obtained from the media context on connect. `null` until
   * a provider responds (or when connected outside a `playerstack-media-controller`).
   */
  private _store: MediaStore | null = null;

  /**
   * Teardown callbacks (store unsubscribe, event listeners) run on disconnect so the
   * element leaves no dangling subscriptions (deterministic cleanup).
   */
  private _disposers: Array<() => void> = [];

  constructor() {
    super();
    // No Shadow DOM: render into the element's own light DOM so composed `playerstack-*`
    // children are real descendants and ordinary CSS selectors work. Styles are injected
    // globally into `document.head` (Req 3.5, 3.7).
    this.root = this;
  }

  /**
   * Ensures the global Style_Layer is present in `document.head` exactly once (Req 3.7),
   * requests the shared media context and subscribes to its store, then renders. Runs each
   * time the element is connected; `addDisposer` keeps the subscription paired with
   * `disconnectedCallback` so reconnects are clean.
   */
  connectedCallback(): void {
    // Style_Auto_Injection: inject the shared Style_Layer into document.head (idempotent).
    ensurePlayerstackStyles();

    // Ask the nearest provider for the shared context. If none responds synchronously the
    // callback simply never runs and the element retries on its next connect.
    requestMediaContext(this, (context) => {
      this._store = context.store;
      const unsubscribe = context.store.subscribe((state) => this.onStoreChange(state));
      this.addDisposer(unsubscribe);
    });

    this.render();
  }

  /**
   * Runs every registered disposer, clears the rendered DOM so a subsequent reconnect
   * triggers a full re-render, and resets the store ref.
   */
  disconnectedCallback(): void {
    for (const dispose of this._disposers) {
      dispose();
    }
    this._disposers = [];
    this._store = null;
    // Clear the light-DOM children so the render guard (`if (this.x !== null) return`) in
    // subclasses passes on reconnect — otherwise the element appears visually correct but
    // has no event listeners or store subscriptions (they were cleaned up by the disposers
    // above). Subclasses override `onDisconnect` to reset their own render-guard fields.
    this.onDisconnect();
  }

  /**
   * Hook for subclasses to reset their render-guard fields (`this.button = null`, etc.)
   * when the element is disconnected. Called by `disconnectedCallback` AFTER disposers
   * have been cleaned up. The base implementation clears the light-DOM children and nulls
   * all own properties that hold DOM node references so subclass render() guards pass on
   * reconnect.
   */
  protected onDisconnect(): void {
    // Clear all rendered children so subclass render() guards pass on reconnect.
    while (this.root.firstChild) {
      this.root.removeChild(this.root.firstChild);
    }
    // Null all own HTMLElement/Node properties so render guards (`if (this.x !== null) return`)
    // allow a full re-render on reconnect. Only properties on the INSTANCE (not prototype) are
    // touched — methods, getters, and inherited fields are untouched.
    for (const key of Object.keys(this)) {
      if (key === 'root' || key.startsWith('_')) continue;
      const val = (this as any)[key];
      if (val instanceof HTMLElement || val instanceof SVGElement) {
        (this as any)[key] = null;
      }
    }
  }

  /**
   * Converts a changed attribute back to its prop value respecting the declared `type`
   * (Req 7.2), then hands it to the overridable `onAttributeChanged` hook. Kept minimal:
   * the base class only performs the type-correct conversion; subclasses decide how to
   * react (e.g. re-render).
   */
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const schema = (this.constructor as typeof PlayerstackElement).attributeSchema;
    // Find the prop key whose entry declares this attribute name (falling back to a key
    // that equals the attribute name). Guard indexing for `noUncheckedIndexedAccess`.
    const propKey = Object.keys(schema).find((key) => (schema[key]?.attribute ?? key) === name);
    if (propKey === undefined) {
      return;
    }
    const entry = schema[propKey];
    if (entry === undefined) {
      return;
    }
    const propValue = attributeToProp(value, entry.type);
    this.onAttributeChanged(propKey, propValue);
  }

  /**
   * Hook invoked with the converted prop key/value after an observed attribute changes.
   * No-op by default; subclasses override to react (e.g. update internal state or
   * re-render).
   */
  protected onAttributeChanged(_propKey: string, _value: string | number | boolean): void {
    // Intentionally empty: subclasses override to react to attribute changes.
  }

  /**
   * Invoked with the latest store state on every change. No-op by default so subclasses
   * opt in to reflecting exactly the subset of state they care about (per design), which
   * avoids reflecting every `PlayerState` key onto the host.
   */
  onStoreChange(_state: Readonly<MediaStoreState>): void {
    // Intentionally empty: subclasses override to reflect the state they need.
  }

  /**
   * Reflects a subset of state to `data-*` attributes on the host (Req 3.3). Applies the
   * pure `reflectStateToAttributes` and then sets or removes each host attribute: a
   * `null` reflected value removes the attribute, any other value sets it. Provided so
   * subclasses can reflect their chosen state from `onStoreChange`.
   */
  protected reflectState(partial: Readonly<ReflectableState>): void {
    const attributes = reflectStateToAttributes(partial);
    for (const attribute of Object.keys(attributes)) {
      const value = attributes[attribute as keyof typeof attributes];
      if (value === null || value === undefined) {
        this.removeAttribute(attribute);
      } else {
        this.setAttribute(attribute, value);
      }
    }
  }

  /**
   * Registers a teardown callback run on disconnect. Used for store unsubscribes and any
   * DOM listeners a subclass adds, keeping cleanup deterministic.
   */
  protected addDisposer(fn: () => void): void {
    this._disposers.push(fn);
  }

  /**
   * Emits a request event expressing user intent without touching the media element
   * directly (Req 2.1). `bubbles` + `composed` let the event climb up to the
   * `MediaController` on the root host (`composed` is harmless in light DOM).
   */
  protected dispatchRequest<D>(type: string, detail?: D): void {
    this.dispatchEvent(new CustomEvent<D>(type, { detail, bubbles: true, composed: true }));
  }

  /**
   * The shared media store once the context has been resolved, or `null` before a
   * provider responds. Read-only accessor for subclasses.
   */
  protected get store(): MediaStore | null {
    return this._store;
  }

  /**
   * Renders the element's light-DOM markup into `this.root` (the element itself).
   * Implemented by each concrete UI_Element.
   */
  protected abstract render(): void;
}
