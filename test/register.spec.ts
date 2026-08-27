import { registerPlayerstackElements } from '@ui/register';
import { PLAYERSTACK_ELEMENTS } from '@ui/element-registry';
import type { PlayerstackElementDefinition } from '@typings/ui/register.types';

/**
 * A fake, injectable registry that mirrors the slice of `CustomElementRegistry` that
 * `registerPlayerstackElements` relies on (`get` + `define`). Using a fake instead of the
 * global `customElements` keeps each test deterministic and isolated: the global registry
 * forbids re-defining a name across tests/files, whereas the fake is created fresh per test.
 * The `defined` map is the source of truth for assertions about what got registered.
 */
function createFakeRegistry() {
  const map = new Map<string, CustomElementConstructor>();
  return {
    defined: map,
    get: jest.fn((name: string) => map.get(name)),
    define: jest.fn((name: string, ctor: CustomElementConstructor) => {
      map.set(name, ctor);
    }),
  };
}

// Minimal stub element classes. They are never connected to the DOM here — the tests only
// assert that the registry receives them, so empty subclasses of HTMLElement suffice.
class ElA extends HTMLElement {}
class ElB extends HTMLElement {}

// The `playerstack-${string}` template of `PlayerstackElementDefinition.name` matches these
// prefixed tag names, so no cast is needed on the definitions themselves.
const defs: PlayerstackElementDefinition[] = [
  { name: 'playerstack-a', ctor: ElA },
  { name: 'playerstack-b', ctor: ElB },
];

describe('registerPlayerstackElements', () => {
  describe('registration (Req 1.2)', () => {
    it('defines every provided element under its playerstack- prefixed name', () => {
      const fake = createFakeRegistry();

      registerPlayerstackElements(fake as unknown as CustomElementRegistry, defs);

      expect(fake.define).toHaveBeenCalledTimes(2);
      expect(fake.define).toHaveBeenCalledWith('playerstack-a', ElA);
      expect(fake.define).toHaveBeenCalledWith('playerstack-b', ElB);
      expect(fake.defined.get('playerstack-a')).toBe(ElA);
      expect(fake.defined.get('playerstack-b')).toBe(ElB);
    });
  });

  describe('re-definition guard (Req 1.3)', () => {
    it('skips an already-defined element and continues registering the rest', () => {
      const fake = createFakeRegistry();
      // Pre-seed the registry so `get('playerstack-a')` returns a constructor: the guard must
      // skip this name (never call define for it) yet still define the remaining element.
      class Existing extends HTMLElement {}
      fake.defined.set('playerstack-a', Existing);

      registerPlayerstackElements(fake as unknown as CustomElementRegistry, defs);

      expect(fake.define).toHaveBeenCalledTimes(1);
      expect(fake.define).toHaveBeenCalledWith('playerstack-b', ElB);
      expect(fake.define).not.toHaveBeenCalledWith('playerstack-a', ElA);
      // The pre-seeded constructor is preserved (not overwritten by ElA).
      expect(fake.defined.get('playerstack-a')).toBe(Existing);
      expect(fake.defined.get('playerstack-b')).toBe(ElB);
    });

    it('is idempotent: a second call defines nothing new and does not throw', () => {
      const fake = createFakeRegistry();

      registerPlayerstackElements(fake as unknown as CustomElementRegistry, defs);
      expect(fake.define).toHaveBeenCalledTimes(2);

      // Second call: every name is already defined, so the guard skips all of them.
      expect(() => registerPlayerstackElements(fake as unknown as CustomElementRegistry, defs)).not.toThrow();
      expect(fake.define).toHaveBeenCalledTimes(2);
    });
  });

  describe('default definitions argument (Req 1.2)', () => {
    it('uses the PLAYERSTACK_ELEMENTS table when defs are omitted, without throwing', () => {
      const fake = createFakeRegistry();

      // Exercises the default-argument path: with `defs` omitted, the function must register
      // every entry of the PLAYERSTACK_ELEMENTS table under its `playerstack-` prefixed name.
      expect(() => registerPlayerstackElements(fake as unknown as CustomElementRegistry)).not.toThrow();

      expect(fake.define).toHaveBeenCalledTimes(PLAYERSTACK_ELEMENTS.length);
      for (const { name, ctor } of PLAYERSTACK_ELEMENTS) {
        expect(fake.define).toHaveBeenCalledWith(name, ctor);
        expect(fake.defined.get(name)).toBe(ctor);
      }
    });
  });
});
