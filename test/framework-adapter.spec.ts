import { domFrameworkAdapter, UI_ELEMENT_BINDINGS } from '@adapters/framework-adapter';
import { PLAYERSTACK_ELEMENTS } from '@ui/element-registry';

/**
 * Tests for the framework-agnostic adapter contract (Req 8.4, 17.5).
 *
 * `domFrameworkAdapter` is the shared DOM-backed implementation every framework binding
 * builds on, so these tests pin down its three primitives (attribute reflection, property
 * assignment, event subscription) directly against real jsdom elements. The
 * `UI_ELEMENT_BINDINGS` tests guard the invariant that the binding table stays in lockstep
 * with the element registry: every registered `playerstack-*` element must have exactly one
 * binding and vice versa (Req 8.4), otherwise a framework adapter would silently miss an
 * element.
 */
describe('domFrameworkAdapter', () => {
  describe('syncAttribute (Req 8.2)', () => {
    it('sets a string value as an HTML attribute', () => {
      const el = document.createElement('div');

      domFrameworkAdapter.syncAttribute(el, 'aria-label', 'Play');

      expect(el.getAttribute('aria-label')).toBe('Play');
    });

    it('stringifies a number value', () => {
      const el = document.createElement('div');

      domFrameworkAdapter.syncAttribute(el, 'width', 24);

      expect(el.getAttribute('width')).toBe('24');
    });

    it('removes the attribute when the value is null', () => {
      const el = document.createElement('div');
      el.setAttribute('aria-label', 'Play');

      domFrameworkAdapter.syncAttribute(el, 'aria-label', null);

      expect(el.hasAttribute('aria-label')).toBe(false);
    });

    it('sets a presence (empty) attribute when the boolean value is true', () => {
      const el = document.createElement('div');

      domFrameworkAdapter.syncAttribute(el, 'hidden', true);

      expect(el.hasAttribute('hidden')).toBe(true);
      expect(el.getAttribute('hidden')).toBe('');
    });

    it('removes the attribute when the boolean value is false', () => {
      const el = document.createElement('div');
      el.setAttribute('hidden', '');

      domFrameworkAdapter.syncAttribute(el, 'hidden', false);

      expect(el.hasAttribute('hidden')).toBe(false);
    });
  });

  describe('syncProperty (Req 8.2)', () => {
    it('assigns the value as a JavaScript property on the element', () => {
      const el = document.createElement('div');

      domFrameworkAdapter.syncProperty(el, 'foo', 123);

      // Typed cast for the read: `foo` is not a declared property of HTMLDivElement.
      expect((el as unknown as { foo: number }).foo).toBe(123);
    });
  });

  describe('subscribe (Req 8.3)', () => {
    it('registers a listener that receives dispatched events', () => {
      const el = document.createElement('div');
      const handler = jest.fn();

      domFrameworkAdapter.subscribe(el, 'playerstack-play-request', handler);
      el.dispatchEvent(new CustomEvent('playerstack-play-request'));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('removes the listener when the returned unsubscribe is called', () => {
      const el = document.createElement('div');
      const handler = jest.fn();

      const unsubscribe = domFrameworkAdapter.subscribe(el, 'playerstack-play-request', handler);
      unsubscribe();
      el.dispatchEvent(new CustomEvent('playerstack-play-request'));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('UI_ELEMENT_BINDINGS', () => {
  describe('coverage of all UI_Elements (Req 8.4)', () => {
    it('has exactly one binding per registered element', () => {
      expect(UI_ELEMENT_BINDINGS.length).toBe(PLAYERSTACK_ELEMENTS.length);
    });

    it('covers every registered element tag and adds no extras', () => {
      const bindingTags = new Set(UI_ELEMENT_BINDINGS.map((binding) => binding.tagName));
      const registryTags = new Set(PLAYERSTACK_ELEMENTS.map((element) => element.name));

      // Every registry tag must have a binding...
      for (const name of registryTags) {
        expect(bindingTags.has(name)).toBe(true);
      }
      // ...and every binding must correspond to a registered element (no orphan bindings).
      for (const tagName of bindingTags) {
        expect(registryTags.has(tagName)).toBe(true);
      }
    });
  });

  describe('binding shape', () => {
    it('every binding has a playerstack- prefixed tagName and array attributes/requestEvents', () => {
      for (const binding of UI_ELEMENT_BINDINGS) {
        expect(typeof binding.tagName).toBe('string');
        expect(binding.tagName.startsWith('playerstack-')).toBe(true);
        expect(Array.isArray(binding.attributes)).toBe(true);
        expect(Array.isArray(binding.requestEvents)).toBe(true);
      }
    });
  });
});
