import { PlayerstackElement } from '@ui/playerstack-element';
import { provideMediaContext } from '@ui/media-context';
import { createMediaStore } from '@ui/media-store';
import type { AttributeSchema } from '@typings/ui/playerstack-element.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { ReflectableState } from '@typings/styles/state-attributes.types';

/**
 * Concrete test subclass of the abstract `PlayerstackElement`. It declares a small
 * attribute schema covering the three reflected types (string/number/boolean), records
 * lifecycle/hook invocations for assertions, and exposes public test-only wrappers around
 * the protected helpers (`dispatchRequest`, `reflectState`, `addDisposer`) so tests can
 * exercise them without `any` casts.
 */
class TestPlayerstackElement extends PlayerstackElement {
  static override attributeSchema: AttributeSchema = {
    label: { attribute: 'label', type: 'string' },
    count: { attribute: 'count', type: 'number' },
    active: { attribute: 'active', type: 'boolean' },
  };

  /** Number of times `render()` ran (once per connect). */
  renderCalls = 0;

  /** Recorded `(propKey, value)` pairs from `onAttributeChanged`. */
  attributeChanges: Array<{ propKey: string; value: string | number | boolean }> = [];

  /** Recorded store states from `onStoreChange`. */
  storeChanges: Array<Readonly<MediaStoreState>> = [];

  protected override render(): void {
    this.renderCalls += 1;
    // Light DOM: `this.root` is the element itself. Append the element's markup directly.
    const button = document.createElement('button');
    button.setAttribute('part', 'button');
    this.root.appendChild(button);
  }

  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    this.attributeChanges.push({ propKey, value });
  }

  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.storeChanges.push(state);
  }

  /** Public wrapper exposing the protected `dispatchRequest` for assertions. */
  emitRequest<D>(type: string, detail?: D): void {
    this.dispatchRequest(type, detail);
  }

  /** Public wrapper exposing the protected `reflectState` for assertions. */
  reflect(partial: Readonly<ReflectableState>): void {
    this.reflectState(partial);
  }

  /** Public wrapper exposing the protected `addDisposer` for assertions. */
  registerDisposer(fn: () => void): void {
    this.addDisposer(fn);
  }
}

// Register the test element under a unique tag, guarding against re-definition across
// files/reloads (Custom Element names can only be defined once per registry).
const TEST_TAG = 'test-pe-element';
if (customElements.get(TEST_TAG) === undefined) {
  customElements.define(TEST_TAG, TestPlayerstackElement);
}

/**
 * Creates the test element via the registry (so the upgraded, defined constructor runs)
 * and returns it typed. Not connected yet — callers append it where needed.
 */
function createElement(): TestPlayerstackElement {
  return document.createElement(TEST_TAG) as TestPlayerstackElement;
}

describe('PlayerstackElement', () => {
  afterEach(() => {
    // Clean up any nodes left on the document body between tests.
    document.body.innerHTML = '';
  });

  describe('observedAttributes (Req 1.1)', () => {
    it('derives observedAttributes from the attribute schema', () => {
      expect(TestPlayerstackElement.observedAttributes).toEqual(['label', 'count', 'active']);
    });
  });

  describe('connect lifecycle (Req 1.1, 3.7)', () => {
    it('uses light DOM (no shadow root) and renders once on connect', () => {
      const el = createElement();
      // No Shadow DOM: the element renders into its own light DOM.
      expect(el.shadowRoot).toBeNull();
      expect(el.renderCalls).toBe(0);

      document.body.appendChild(el);

      expect(el.shadowRoot).toBeNull();
      expect(el.renderCalls).toBe(1);
      // Markup is rendered into the element's own light DOM.
      expect(el.querySelector('button[part="button"]')).not.toBeNull();
    });

    it('injects the global Style_Layer into document.head on connect (Req 3.7)', () => {
      const el = createElement();
      document.body.appendChild(el);

      // Style_Auto_Injection now injects a single global <style data-playerstack-styles>
      // into document.head (no per-element shadow adoption).
      expect(document.head.querySelector('style[data-playerstack-styles]')).not.toBeNull();
    });
  });

  describe('attributeChangedCallback (Req 1.1, 7.2)', () => {
    it('converts a numeric attribute and forwards (propKey, number)', () => {
      const el = createElement();
      document.body.appendChild(el);

      el.setAttribute('count', '5');

      expect(el.attributeChanges).toContainEqual({ propKey: 'count', value: 5 });
    });

    it('converts a boolean attribute presence and forwards (propKey, true)', () => {
      const el = createElement();
      document.body.appendChild(el);

      el.setAttribute('active', '');

      expect(el.attributeChanges).toContainEqual({ propKey: 'active', value: true });
    });

    it('converts a string attribute and forwards (propKey, string)', () => {
      const el = createElement();
      document.body.appendChild(el);

      el.setAttribute('label', 'hello');

      expect(el.attributeChanges).toContainEqual({ propKey: 'label', value: 'hello' });
    });
  });

  describe('media context + onStoreChange (Req 2.3)', () => {
    it('resolves the shared context on connect and reacts to store changes', () => {
      const store = createMediaStore();
      const providerHost = document.createElement('div');
      document.body.appendChild(providerHost);
      // Provider listens on the light-DOM ancestor; the request event bubbles + composes
      // up from the element to this host.
      provideMediaContext(providerHost, { store });

      const el = createElement();
      // Appending to a connected parent triggers connectedCallback, which requests the
      // context from the nearest ancestor provider.
      providerHost.appendChild(el);

      // A subsequent store change flows into the subclass's onStoreChange.
      store.set({ playing: true });

      expect(el.storeChanges.length).toBeGreaterThanOrEqual(1);
      const last = el.storeChanges[el.storeChanges.length - 1];
      expect(last?.playing).toBe(true);
    });

    it('does not throw when connected without a provider (context never resolves)', () => {
      const el = createElement();
      expect(() => document.body.appendChild(el)).not.toThrow();
      expect(el.storeChanges).toHaveLength(0);
    });
  });

  describe('request dispatch (Req 2.1)', () => {
    it('emits a bubbling + composed CustomEvent carrying the detail', () => {
      const el = createElement();
      document.body.appendChild(el);

      const received: Array<CustomEvent<{ x: number }>> = [];
      document.addEventListener('playerstack-play-request', (event) => {
        received.push(event as CustomEvent<{ x: number }>);
      });

      el.emitRequest('playerstack-play-request', { x: 1 });

      expect(received).toHaveLength(1);
      const event = received[0] as CustomEvent<{ x: number }>;
      expect(event.detail.x).toBe(1);
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });
  });

  describe('disposer cleanup (Req 2.3, 3.3)', () => {
    it('runs registered disposers and stops store notifications after disconnect', () => {
      const store = createMediaStore();
      const providerHost = document.createElement('div');
      document.body.appendChild(providerHost);
      provideMediaContext(providerHost, { store });

      const el = createElement();
      providerHost.appendChild(el);

      // Subscribed via context on connect: a store change is observed.
      store.set({ playing: true });
      const changesWhileConnected = el.storeChanges.length;
      expect(changesWhileConnected).toBeGreaterThanOrEqual(1);

      // Disconnecting runs the disposers (store unsubscribe among them).
      providerHost.removeChild(el);

      store.set({ volume: 0.4 });
      // No further onStoreChange calls after disconnect.
      expect(el.storeChanges).toHaveLength(changesWhileConnected);
    });

    it('runs a custom disposer registered via addDisposer on disconnect', () => {
      const el = createElement();
      document.body.appendChild(el);

      const dispose = jest.fn();
      el.registerDisposer(dispose);

      el.remove();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('reflectState sets a data-* attribute and removes it when the value is null (Req 3.3)', () => {
      const el = createElement();
      document.body.appendChild(el);

      el.reflect({ playing: true });
      expect(el.getAttribute('data-playing')).not.toBeNull();

      el.reflect({ playing: null });
      expect(el.getAttribute('data-playing')).toBeNull();
    });
  });
});
