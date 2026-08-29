import { readFileSync } from 'fs';
import { join } from 'path';

import fc from 'fast-check';

import {
  COMPOSABLE_SLOTS,
  DEFAULT_COMPOSITION,
  domFrameworkAdapter,
  resolveSlotOrder,
  UI_ELEMENT_BINDINGS,
} from '@adapters/framework-adapter';
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

/**
 * Tests for the composable-player-components catalog (composable-player-components spec,
 * task 1.3 — Req 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 11.1, 11.2).
 *
 * The catalog (`COMPOSABLE_SLOTS`, `DEFAULT_COMPOSITION`, `resolveSlotOrder`) is the single,
 * framework-agnostic source of truth every skin inherits, so these tests pin down its
 * well-formedness and the purity/determinism of `resolveSlotOrder`. They validate design
 * Property 5 (canonical order) and Property 6 (core purity / A1).
 */

/** Names in canonical ascending `order`, derived without relying on declaration order. */
const CANONICAL_ORDER: readonly string[] = [...COMPOSABLE_SLOTS]
  .sort((a, b) => a.order - b.order)
  .map((slot) => slot.name);

/** Every catalog part name (used to seed fast-check permutations). */
const ALL_SLOT_NAMES: readonly string[] = COMPOSABLE_SLOTS.map((slot) => slot.name);

/** The parts allowed to be containers (Req 3.7). */
const CONTAINER_NAMES = ['BottomBar', 'Player', 'SidebarLeft', 'SidebarRight', 'TopBar'];

describe('COMPOSABLE_SLOTS (composable catalog)', () => {
  const bindingTags = new Set(UI_ELEMENT_BINDINGS.map((binding) => binding.tagName));

  describe('well-formedness', () => {
    it('backs each part with either null or a tag present in UI_ELEMENT_BINDINGS (Req 3.4)', () => {
      for (const slot of COMPOSABLE_SLOTS) {
        const wellFormed = slot.element === null || (typeof slot.element === 'string' && bindingTags.has(slot.element));
        // Surface the offending part name if the assertion fails.
        expect({ name: slot.name, wellFormed }).toEqual({ name: slot.name, wellFormed: true });
      }
    });

    it('sets `container: true` on exactly Player and ControlBar and no other part (Req 3.7)', () => {
      const containers = COMPOSABLE_SLOTS.filter((slot) => slot.container === true)
        .map((slot) => slot.name)
        .sort();

      expect(containers).toEqual(CONTAINER_NAMES);
    });

    it('never marks a non-container part with a truthy `container` flag (Req 3.7)', () => {
      for (const slot of COMPOSABLE_SLOTS) {
        if (!CONTAINER_NAMES.includes(slot.name)) {
          expect(Boolean(slot.container)).toBe(false);
        }
      }
    });

    it('assigns a unique `order` within each region', () => {
      const ordersByRegion = new Map<string, number[]>();
      for (const slot of COMPOSABLE_SLOTS) {
        const orders = ordersByRegion.get(slot.region) ?? [];
        orders.push(slot.order);
        ordersByRegion.set(slot.region, orders);
      }

      for (const [region, orders] of ordersByRegion) {
        expect({ region, unique: new Set(orders).size }).toEqual({ region, unique: orders.length });
      }
    });

    it('gives every part a non-empty, catalog-unique name', () => {
      for (const slot of COMPOSABLE_SLOTS) {
        expect(typeof slot.name).toBe('string');
        expect(slot.name.length).toBeGreaterThan(0);
      }
      expect(new Set(ALL_SLOT_NAMES).size).toBe(ALL_SLOT_NAMES.length);
    });
  });
});

describe('DEFAULT_COMPOSITION (Req 3.5)', () => {
  it('equals exactly the names of parts flagged inDefault, preserving catalog order', () => {
    const expected = COMPOSABLE_SLOTS.filter((slot) => slot.inDefault).map((slot) => slot.name);

    expect([...DEFAULT_COMPOSITION]).toEqual(expected);
  });

  it('includes a part if and only if its inDefault flag is true', () => {
    for (const slot of COMPOSABLE_SLOTS) {
      expect(DEFAULT_COMPOSITION.includes(slot.name)).toBe(slot.inDefault === true);
    }
  });

  it('contains no duplicate names', () => {
    expect(new Set(DEFAULT_COMPOSITION).size).toBe(DEFAULT_COMPOSITION.length);
  });
});

describe('resolveSlotOrder', () => {
  describe('examples', () => {
    it('sorts known names ascending by canonical order (Req 3.6)', () => {
      expect(resolveSlotOrder(['Fullscreen', 'PlayButton', 'BottomBar', 'Player'])).toEqual([
        'Player',
        'BottomBar',
        'PlayButton',
        'Fullscreen',
      ]);
    });

    it('produces the same result regardless of input order (Req 3.6)', () => {
      const forward = ['Player', 'Volume', 'Settings', 'Fullscreen'];
      const reversed = [...forward].reverse();

      expect(resolveSlotOrder(reversed)).toEqual(resolveSlotOrder(forward));
    });

    it('excludes names absent from COMPOSABLE_SLOTS (Req 3.8)', () => {
      expect(resolveSlotOrder(['Volume', 'NotAThing', 'Player', 'totally-unknown'])).toEqual(['Player', 'Volume']);
    });

    it('returns an empty array for empty input and for all-unknown input (Req 3.8)', () => {
      expect(resolveSlotOrder([])).toEqual([]);
      expect(resolveSlotOrder(['nope', 'zzz'])).toEqual([]);
    });

    it('does not mutate the input array and returns a new array instance (Req 3.6)', () => {
      const input = ['Fullscreen', 'Player', 'Volume'];
      const snapshot = [...input];
      const result = resolveSlotOrder(input);

      expect(input).toEqual(snapshot);
      expect(result).not.toBe(input);
    });
  });

  describe('properties (fast-check) — Property 5: canonical order', () => {
    // A random permutation of a distinct subset of catalog names.
    const permutationOfKnownNames = fc.uniqueArray(fc.constantFrom(...ALL_SLOT_NAMES));
    // Strings guaranteed NOT to be catalog names (a leading NUL can never appear in a name).
    const unknownName = fc.string().map((suffix) => `\u0000${suffix}`);

    it('returns the canonical ascending order independent of input order, without mutating input (Req 3.6)', () => {
      // Validates: Requirements 3.6 (Design: Property 5)
      fc.assert(
        fc.property(permutationOfKnownNames, (names) => {
          const before = [...names];
          const expected = CANONICAL_ORDER.filter((name) => before.includes(name));

          const result = resolveSlotOrder(names);

          // Canonical ascending order, independent of the (randomized) input order.
          expect(result).toEqual(expected);
          // Reversing the input yields the identical result -> order independence.
          expect(resolveSlotOrder([...before].reverse())).toEqual(expected);
          // Purity: the input array is left untouched and a fresh array is returned.
          expect(names).toEqual(before);
          expect(result).not.toBe(names);
        }),
      );
    });

    it('excludes unknown names and keeps known names in canonical order (Req 3.8)', () => {
      // Validates: Requirements 3.8 (Design: Property 5)
      fc.assert(
        fc.property(permutationOfKnownNames, fc.array(unknownName), (knownNames, unknownNames) => {
          const knownSet = new Set(knownNames);
          const input = [...knownNames, ...unknownNames];
          const before = [...input];
          const expected = CANONICAL_ORDER.filter((name) => knownSet.has(name));

          const result = resolveSlotOrder(input);

          expect(result).toEqual(expected);
          // No unknown name survives in the result.
          for (const name of result) {
            expect(knownSet.has(name)).toBe(true);
          }
          expect(input).toEqual(before);
        }),
      );
    });
  });
});

describe('catalog purity and determinism (Req 3.3, 11.1, 11.2) — Property 6: core purity', () => {
  it('resolveSlotOrder is deterministic — repeated calls on the same input are deep-equal', () => {
    // Validates: Requirements 3.3, 11.1 (Design: Property 6)
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(...ALL_SLOT_NAMES)), (names) => {
        expect(resolveSlotOrder(names)).toEqual(resolveSlotOrder(names));
      }),
    );
  });

  it('does not rely on or mutate shared catalog state across calls', () => {
    const slotsSnapshot = JSON.parse(JSON.stringify(COMPOSABLE_SLOTS));
    const defaultSnapshot = [...DEFAULT_COMPOSITION];

    resolveSlotOrder(['Fullscreen', 'Player']);
    resolveSlotOrder([]);
    resolveSlotOrder(['unknown', 'Volume', 'Player']);

    expect(JSON.parse(JSON.stringify(COMPOSABLE_SLOTS))).toEqual(slotsSnapshot);
    expect([...DEFAULT_COMPOSITION]).toEqual(defaultSnapshot);
  });

  it('keeps the catalog module free of any UI-framework import (A1, Req 11.2)', () => {
    // Validates: Requirements 11.2 (Design: Property 6). A source-level guard: the catalog
    // must never import a UI framework. Targets real import/require syntax so prose mentions
    // of "React" in comments do not produce a false positive.
    const source = readFileSync(join(__dirname, '..', 'src', 'adapters', 'framework-adapter.ts'), 'utf8');

    expect(source).not.toMatch(/from\s+['"](react|react-dom|vue|solid-js|svelte|@angular\/core)['"]/);
    expect(source).not.toMatch(/require\(\s*['"](react|react-dom|vue|solid-js|svelte|@angular\/core)['"]\s*\)/);
  });
});
