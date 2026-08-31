import { readFileSync } from 'fs';
import { join } from 'path';

import fc from 'fast-check';

import {
  acceptsKeepVisible,
  AUDIO_DEFAULT_COMPOSITION,
  COMPOSABLE_SLOTS,
  DEFAULT_COMPOSITION,
  domFrameworkAdapter,
  resolveSlotOrder,
  UI_ELEMENT_BINDINGS,
  validateSlotPlacement,
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

/** The parts allowed to be containers (Req 3.7 / Req 15.1/15.2). */
const CONTAINER_NAMES = [
  'BottomBar',
  'CenterControls',
  'DesktopUI',
  'MobileUI',
  'Player',
  'SidebarLeft',
  'SidebarRight',
  'TopBar',
];

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

    it('sets `container: true` on exactly the container parts and no other part (Req 3.7/15.1/15.2)', () => {
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

/**
 * Tests for the AUDIO additions to the composable catalog (composable-audio-player-components
 * spec, task 1.3 — Req 3.1, 3.4, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 11.1, 11.2).
 *
 * The audio skin reuses the SAME agnostic catalog (`COMPOSABLE_SLOTS`/`resolveSlotOrder`) and
 * only extends it with the audio-exclusive parts (`AudioControls`, `SkipBack`, `SkipForward`)
 * plus the `inDefaultAudio`-derived `AUDIO_DEFAULT_COMPOSITION`. These tests guard that the
 * audio entries are well-formed, that their `order` indices never collide with any video entry,
 * that the audio default is exactly the expected set (no duplicates, no nav), and that
 * `resolveSlotOrder` behaves correctly for audio names — without touching the existing video
 * assertions above.
 */

/** The audio-exclusive parts added to the catalog for the audio skin (Req 3.6). */
const AUDIO_ONLY_NAMES = ['AudioControls', 'SkipBack', 'SkipForward', 'Time'] as const;

/** The full set of part names the audio skin composes with (exclusive + reused-by-name, Req 3.5). */
const AUDIO_PART_NAMES = [
  'AudioControls',
  'PlayButton',
  'SkipBack',
  'SkipForward',
  'Title',
  'Chapters',
  'PrevButton',
  'NextButton',
  'Volume',
  'Settings',
] as const;

describe('COMPOSABLE_SLOTS — audio additions (Req 3.1, 3.4, 3.7)', () => {
  const bindingTags = new Set(UI_ELEMENT_BINDINGS.map((binding) => binding.tagName));
  const slotByName = new Map(COMPOSABLE_SLOTS.map((slot) => [slot.name, slot] as const));

  it('defines the audio-exclusive parts AudioControls/SkipBack/SkipForward in the catalog (Req 3.1/3.6)', () => {
    for (const name of AUDIO_ONLY_NAMES) {
      expect(slotByName.has(name)).toBe(true);
    }
  });

  it('backs AudioControls with playerstack-audio-controls (a bound tag) and skips with null (Req 3.4)', () => {
    expect(slotByName.get('AudioControls')?.element).toBe('playerstack-audio-controls');
    expect(bindingTags.has('playerstack-audio-controls')).toBe(true);
    // Skip markers gate the single audio-controls element, so they render no element of their own.
    expect(slotByName.get('SkipBack')?.element).toBeNull();
    expect(slotByName.get('SkipForward')?.element).toBeNull();
  });

  it('gives every non-null audio entry element a tag present in UI_ELEMENT_BINDINGS (Req 3.4)', () => {
    for (const name of AUDIO_ONLY_NAMES) {
      const slot = slotByName.get(name);
      const wellFormed = slot?.element === null || (typeof slot?.element === 'string' && bindingTags.has(slot.element));
      expect({ name, wellFormed }).toEqual({ name, wellFormed: true });
    }
  });

  it('marks AudioControls as a non-container part (Req 3.7)', () => {
    // AudioControls hosts play/pause/skip/title/chapters as presence markers, not nested slots.
    expect(Boolean(slotByName.get('AudioControls')?.container)).toBe(false);
  });

  it('flags exactly the audio-default parts with inDefaultAudio and no other part', () => {
    const flagged = COMPOSABLE_SLOTS.filter((slot) => slot.inDefaultAudio === true)
      .map((slot) => slot.name)
      .sort();
    const expected = [
      'AudioControls',
      'PlayButton',
      'SkipBack',
      'SkipForward',
      'Title',
      'Chapters',
      'Time',
      'Volume',
      'Settings',
    ].sort();

    expect(flagged).toEqual(expected);
  });

  it('keeps every audio order index unique and free of collision with any video entry (Req 3.7)', () => {
    // Audio-exclusive orders must be unique among themselves...
    const audioOrders = AUDIO_ONLY_NAMES.map((name) => slotByName.get(name)?.order);
    expect(new Set(audioOrders).size).toBe(audioOrders.length);

    // ...and must not collide with any video (non-audio-exclusive) entry sharing the same region.
    for (const name of AUDIO_ONLY_NAMES) {
      const audioSlot = slotByName.get(name);
      expect(audioSlot).toBeDefined();
      const collisions = COMPOSABLE_SLOTS.filter(
        (slot) =>
          !AUDIO_ONLY_NAMES.includes(slot.name as (typeof AUDIO_ONLY_NAMES)[number]) &&
          slot.region === audioSlot?.region &&
          slot.order === audioSlot?.order,
      );
      expect({ name, collisions: collisions.map((s) => s.name) }).toEqual({ name, collisions: [] });
    }
  });
});

describe('AUDIO_DEFAULT_COMPOSITION (Req 3.8, 3.9)', () => {
  it('equals exactly the names of parts flagged inDefaultAudio, preserving catalog order', () => {
    const expected = COMPOSABLE_SLOTS.filter((slot) => slot.inDefaultAudio === true).map((slot) => slot.name);

    expect([...AUDIO_DEFAULT_COMPOSITION]).toEqual(expected);
  });

  it('contains exactly the expected audio default parts (Req 3.8)', () => {
    // Membership (order-independent): AudioControls + PlayButton + Skip* + Title + Chapters + Time
    // + Volume + Settings.
    expect([...AUDIO_DEFAULT_COMPOSITION].sort()).toEqual(
      ['AudioControls', 'PlayButton', 'SkipBack', 'SkipForward', 'Title', 'Chapters', 'Time', 'Volume', 'Settings'].sort(),
    );
  });

  it('includes a part if and only if its inDefaultAudio flag is true', () => {
    for (const slot of COMPOSABLE_SLOTS) {
      expect(AUDIO_DEFAULT_COMPOSITION.includes(slot.name)).toBe(slot.inDefaultAudio === true);
    }
  });

  it('contains no duplicate names', () => {
    expect(new Set(AUDIO_DEFAULT_COMPOSITION).size).toBe(AUDIO_DEFAULT_COMPOSITION.length);
  });

  it('excludes nav (PrevButton/NextButton) from the audio default (Req 3.9)', () => {
    expect(AUDIO_DEFAULT_COMPOSITION.includes('PrevButton')).toBe(false);
    expect(AUDIO_DEFAULT_COMPOSITION.includes('NextButton')).toBe(false);
  });
});

describe('resolveSlotOrder — audio part names (Req 3.10, 3.11, 3.12)', () => {
  /** Audio part names in canonical ascending order, derived from the catalog (not declaration order). */
  const AUDIO_CANONICAL_ORDER: readonly string[] = [...COMPOSABLE_SLOTS]
    .filter((slot) => AUDIO_PART_NAMES.includes(slot.name as (typeof AUDIO_PART_NAMES)[number]))
    .sort((a, b) => a.order - b.order)
    .map((slot) => slot.name);

  describe('examples', () => {
    it('sorts audio names ascending by canonical order (Req 3.10)', () => {
      // Canonical order indices: PlayButton(60) < Settings(120) < AudioControls(200) < SkipBack(205)
      // < SkipForward(215). resolveSlotOrder is global-ascending (it does not group by region), so
      // Settings(120) precedes AudioControls(200) even though they live in different regions.
      expect(resolveSlotOrder(['Settings', 'AudioControls', 'PlayButton', 'SkipForward', 'SkipBack'])).toEqual([
        'PlayButton',
        'Settings',
        'AudioControls',
        'SkipBack',
        'SkipForward',
      ]);
    });

    it('produces the same result regardless of input order (Req 3.10)', () => {
      const forward = ['AudioControls', 'PlayButton', 'SkipBack', 'SkipForward', 'Volume', 'Settings'];
      const reversed = [...forward].reverse();

      expect(resolveSlotOrder(reversed)).toEqual(resolveSlotOrder(forward));
    });

    it('excludes unknown names from a mixed audio input (Req 3.11)', () => {
      expect(resolveSlotOrder(['SkipForward', 'not-a-part', 'AudioControls', 'PlayButton', 'zzz'])).toEqual([
        'PlayButton',
        'AudioControls',
        'SkipForward',
      ]);
    });

    it('returns an empty array for empty input and for all-unknown input (Req 3.12)', () => {
      expect(resolveSlotOrder([])).toEqual([]);
      expect(resolveSlotOrder(['skip-back', 'AUDIOCONTROLS'])).toEqual([]);
    });

    it('does not mutate the input array and returns a new array instance (Req 3.10)', () => {
      const input = ['SkipForward', 'AudioControls', 'SkipBack'];
      const snapshot = [...input];
      const result = resolveSlotOrder(input);

      expect(input).toEqual(snapshot);
      expect(result).not.toBe(input);
    });
  });

  describe('properties (fast-check) — audio canonical order', () => {
    const permutationOfAudioNames = fc.uniqueArray(fc.constantFrom(...AUDIO_PART_NAMES));
    const unknownName = fc.string().map((suffix) => `\u0000${suffix}`);

    it('returns audio names in canonical ascending order independent of input order, without mutating input (Req 3.10)', () => {
      // Validates: Requirements 3.10
      fc.assert(
        fc.property(permutationOfAudioNames, (names) => {
          const before = [...names];
          const expected = AUDIO_CANONICAL_ORDER.filter((name) => before.includes(name));

          const result = resolveSlotOrder(names);

          expect(result).toEqual(expected);
          expect(resolveSlotOrder([...before].reverse())).toEqual(expected);
          expect(names).toEqual(before);
          expect(result).not.toBe(names);
        }),
      );
    });

    it('excludes unknown names and keeps known audio names in canonical order (Req 3.11, 3.12)', () => {
      // Validates: Requirements 3.11, 3.12
      fc.assert(
        fc.property(permutationOfAudioNames, fc.array(unknownName), (knownNames, unknownNames) => {
          const knownSet = new Set(knownNames);
          const input = [...knownNames, ...unknownNames];
          const before = [...input];
          const expected = AUDIO_CANONICAL_ORDER.filter((name) => knownSet.has(name));

          const result = resolveSlotOrder(input);

          expect(result).toEqual(expected);
          for (const name of result) {
            expect(knownSet.has(name)).toBe(true);
          }
          expect(input).toEqual(before);
        }),
      );
    });
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

describe('validateSlotPlacement — container-placement restriction (Req 16)', () => {
  const RESTRICTED = ['Timeline', 'Chapters', 'Heatmap'] as const;
  const FORBIDDEN_CONTAINERS = ['TopBar', 'SidebarLeft', 'SidebarRight', 'CenterControls'] as const;

  it('marks Timeline/Chapters/Heatmap as BottomBar-only in the catalog', () => {
    for (const name of RESTRICTED) {
      const slot = COMPOSABLE_SLOTS.find((s) => s.name === name);
      expect(slot?.allowedContainers).toEqual(['BottomBar']);
    }
  });

  it('allows a restricted part inside BottomBar', () => {
    for (const name of RESTRICTED) {
      expect(validateSlotPlacement(name, 'BottomBar')).toEqual({ ok: true });
    }
  });

  it('rejects a restricted part inside any other container, with a descriptive reason', () => {
    for (const name of RESTRICTED) {
      for (const container of FORBIDDEN_CONTAINERS) {
        const result = validateSlotPlacement(name, container);
        expect(result.ok).toBe(false);
        expect(result.reason).toContain(`<${name}>`);
        expect(result.reason).toContain('<BottomBar>');
        expect(result.reason).toContain(`<${container}>`);
      }
    }
  });

  it('rejects a restricted part at the top level (no container)', () => {
    for (const name of RESTRICTED) {
      const result = validateSlotPlacement(name, null);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('at the top level');
    }
  });

  it('allows unrestricted parts anywhere (no allowedContainers)', () => {
    expect(validateSlotPlacement('Volume', 'TopBar')).toEqual({ ok: true });
    expect(validateSlotPlacement('Settings', 'SidebarLeft')).toEqual({ ok: true });
    expect(validateSlotPlacement('PlayButton', null)).toEqual({ ok: true });
  });

  it('is pure/deterministic — repeated calls yield deep-equal results', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_SLOT_NAMES),
        fc.option(fc.constantFrom(...ALL_SLOT_NAMES), { nil: null }),
        (part, container) => {
          expect(validateSlotPlacement(part, container)).toEqual(validateSlotPlacement(part, container));
        },
      ),
    );
  });
});

/**
 * Tests for the timeline-rider `keepVisible` opt-out (`ridesTimeline` + `acceptsKeepVisible`).
 *
 * `Chapters`/`Heatmap` ride the `Timeline` slider (they paint via props on
 * `playerstack-time-slider` and own no element of their own), so their visibility follows the
 * Timeline's keep-visible and they do NOT accept an independent `keepVisible`. The catalog flags
 * them with `ridesTimeline: true` and the pure `acceptsKeepVisible` reads that flag — the single
 * source of truth every skin resolver enforces (A6/A7).
 */
describe('ridesTimeline flag + acceptsKeepVisible (timeline-rider keepVisible opt-out)', () => {
  const slotByName = new Map(COMPOSABLE_SLOTS.map((slot) => [slot.name, slot] as const));

  it('flags Chapters and Heatmap as timeline riders, but NOT Timeline itself', () => {
    expect(slotByName.get('Chapters')?.ridesTimeline).toBe(true);
    expect(slotByName.get('Heatmap')?.ridesTimeline).toBe(true);
    // Timeline IS the host slider — it must NOT be flagged (it accepts keepVisible).
    expect(Boolean(slotByName.get('Timeline')?.ridesTimeline)).toBe(false);
  });

  it('rejects keepVisible for the timeline riders (Chapters/Heatmap)', () => {
    expect(acceptsKeepVisible('Chapters')).toBe(false);
    expect(acceptsKeepVisible('Heatmap')).toBe(false);
  });

  it('accepts keepVisible for Timeline (the host slider) and other regular parts', () => {
    expect(acceptsKeepVisible('Timeline')).toBe(true);
    expect(acceptsKeepVisible('Volume')).toBe(true);
  });

  it('defaults to accepting keepVisible for unknown part names (permissive)', () => {
    expect(acceptsKeepVisible('SomeUnknown')).toBe(true);
  });

  it('returns false iff the slot is flagged ridesTimeline (consistent with the catalog)', () => {
    for (const slot of COMPOSABLE_SLOTS) {
      expect(acceptsKeepVisible(slot.name)).toBe(slot.ridesTimeline !== true);
    }
  });
});
