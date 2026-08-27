/**
 * Pure, deterministic helpers that reflect a UI_Element's `ReflectableState` to
 * `data-*` attributes and read it back (Req 3.3, 13.1, 13.3).
 *
 * `reflectStateToAttributes` and `readStateFromAttributes` are exact inverses:
 * `readStateFromAttributes(reflectStateToAttributes(state))` deep-equals the original
 * `state` for every value of type `string | number | boolean | null`. This is what
 * enables the state<->attribute roundtrip property (Property 2, Req 20.2). Neither
 * function mutates its input; both build and return brand-new objects (Req 13.3).
 *
 * ---
 * WHY the key mapping is a camelCase<->kebab-case bijection:
 *
 * A state key (e.g. `isEnded`, `playing`) becomes a `data-<kebab-case>` attribute name
 * (`data-is-ended`, `data-playing`) and must map back to the EXACT original key so the
 * roundtrip preserves keys precisely. Each uppercase letter `X` in the key is encoded
 * as `-x` (lowercased) in the attribute name; the inverse re-uppercases the letter that
 * follows each hyphen. This is a true bijection ONLY over keys shaped like
 * `^[a-z][a-zA-Z0-9]*$` (start lowercase, then letters/digits, no hyphens/underscores).
 * The Property 2 generator (task 2.7) constrains generated keys to that space, so the
 * assumption holds. Keys outside that shape are out of contract.
 *
 * ---
 * WHY values are JSON-encoded:
 *
 * Attribute values are `string | null`, yet the state value space is
 * `string | number | boolean | null`. To round-trip by TYPE (so a numeric `1` does not
 * come back as the string `"1"`, and a boolean `true` does not come back as `"true"`),
 * the type must be encoded in the attribute string. The scheme:
 *   - `null`  -> attribute value `null` (i.e. the attribute is absent). Decodes to `null`.
 *   - anything else -> `JSON.stringify(value)`. `JSON.parse` on read restores the exact
 *     string/number/boolean value.
 * This is a clean, unambiguous bijection: `null` <-> absent attribute, and JSON handles
 * strings, numbers and booleans losslessly. It keeps the encoding consistent with the
 * `string | null` value type of `AttributeReflection`.
 */
import type { AttributeReflection, ReflectableState } from '@typings/styles/state-attributes.types';

/**
 * Fixed prefix shared by every reflected `data-*` attribute. Kept as a constant so the
 * forward mapping and its inverse can never drift apart.
 */
const DATA_PREFIX = 'data-';

/**
 * Converts a camelCase state key to its kebab-case `data-*` attribute name. Each
 * uppercase letter becomes `-<lowercase>` (e.g. `isEnded` -> `data-is-ended`).
 */
function stateKeyToDataAttribute(key: string): `data-${string}` {
  const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `${DATA_PREFIX}${kebab}`;
}

/**
 * Converts a `data-*` attribute name back to its camelCase state key. Each hyphen is
 * removed and the letter that follows it is uppercased (e.g. `data-is-ended` ->
 * `isEnded`). Exact inverse of `stateKeyToDataAttribute` over the documented key space.
 */
function dataAttributeToStateKey(attribute: string): string {
  const body = attribute.slice(DATA_PREFIX.length);
  return body.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Reflects a `ReflectableState` to its `data-*` attribute map (Req 3.3, 13.3). Does NOT
 * mutate `state`: iterates its keys and returns a fresh `AttributeReflection`. `null`
 * values are encoded as `null` (attribute absent); every other value is JSON-encoded so
 * its type survives the roundtrip.
 */
export function reflectStateToAttributes(state: Readonly<ReflectableState>): AttributeReflection {
  const attributes: AttributeReflection = {};

  for (const key of Object.keys(state)) {
    const value = state[key];
    const attribute = stateKeyToDataAttribute(key);
    attributes[attribute] = value === null ? null : JSON.stringify(value);
  }

  return attributes;
}

/**
 * Reads a `data-*` attribute map back into a `ReflectableState` (Req 3.3). Exact inverse
 * of `reflectStateToAttributes`. Does NOT mutate `attrs`: iterates its keys and returns
 * a fresh `ReflectableState`. A `null` attribute value decodes to `null`; any other
 * value is JSON-parsed to restore its original string/number/boolean type.
 */
export function readStateFromAttributes(attrs: Readonly<AttributeReflection>): ReflectableState {
  const state: ReflectableState = {};

  for (const attribute of Object.keys(attrs)) {
    const value = attrs[attribute as keyof AttributeReflection];
    const key = dataAttributeToStateKey(attribute);
    // A `null` or absent (`undefined`) attribute value decodes to `null`; any other
    // value is JSON-parsed to restore its original string/number/boolean type. Guarding
    // `undefined` keeps this total under `noUncheckedIndexedAccess`.
    state[key] = value === null || value === undefined ? null : (JSON.parse(value) as string | number | boolean);
  }

  return state;
}
