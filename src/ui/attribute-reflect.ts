/**
 * Pure, deterministic helpers that convert a Custom Element property value to its
 * serialized attribute form and back, respecting the declared `AttributeSchemaEntry`
 * `type` (Req 7.2, 13.1). No DOM access, no side-effects.
 *
 * `propToAttribute` and `attributeToProp` are inverses per `type`: for a value produced
 * for a given `type`, `attributeToProp(propToAttribute(value, type), type) === value`.
 * This is what enables the prop<->attribute roundtrip property (Property 4, Req 20.4).
 *
 * ---
 * WHY the encoding differs per `type`:
 *
 * - `boolean` — HTML boolean-attribute *presence* convention. An HTML boolean attribute
 *   is `true` when present (regardless of its string value) and `false` when absent.
 *   So `propToAttribute(true, 'boolean')` returns `''` (present, empty string) and
 *   `propToAttribute(false, 'boolean')` returns `null` (remove the attribute / absent).
 *   Reading back, `attributeToProp(value, 'boolean')` is `value !== null`: any present
 *   value (including `''`) decodes to `true`, an absent attribute (`null`) to `false`.
 *   This roundtrips `true`/`false` exactly and matches how browsers treat attributes
 *   like `disabled`, `hidden`, etc.
 *
 * - `number` — serialized with `String(n)`; parsed back with `Number(s)`. If the
 *   attribute is absent (`null`) or does not parse to a finite number (`Number(s)` is
 *   `NaN`), we FALL BACK to the type default `0`. Note: the Property 4 generator must
 *   generate finite numbers, because non-finite inputs (`NaN`, `Infinity`) do not
 *   survive the roundtrip — `String(NaN)` -> `'NaN'` -> `Number('NaN')` -> `NaN`, which
 *   then falls back to `0`. Finite numbers roundtrip exactly.
 *
 * - `string` — identity on serialize (`s` -> `s`); on read, `null` (absent attribute)
 *   falls back to the type default `''`, otherwise the string is returned unchanged.
 */
import type { AttributeSchemaEntry } from '@typings/ui/playerstack-element.types';
import type { ReflectedPropValue } from '@typings/ui/attribute-reflect.types';

/**
 * Declared attribute type union, reused from `AttributeSchemaEntry` so this module and
 * the schema can never drift apart.
 */
type ReflectedPropType = AttributeSchemaEntry['type'];

/**
 * Default property value per declared `type`, used when an attribute is absent or does
 * not parse: `string -> ''`, `number -> 0`, `boolean -> false`.
 */
const TYPE_DEFAULTS: Readonly<Record<ReflectedPropType, ReflectedPropValue>> = {
  string: '',
  number: 0,
  boolean: false,
};

/**
 * Serializes a property `value` to its attribute string form for the declared `type`
 * (Req 7.2). Returns `string | null`, where `null` means "remove the attribute".
 *
 * - `boolean`: `true` -> `''` (present), `false` -> `null` (absent) — HTML boolean
 *   presence convention.
 * - `number`: `String(value)`.
 * - `string`: the value unchanged.
 */
export function propToAttribute(value: ReflectedPropValue, type: ReflectedPropType): string | null {
  switch (type) {
    case 'boolean':
      // Presence semantics: present (empty string) when true, absent (null) when false.
      return value ? '' : null;
    case 'number':
      return String(value);
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Parses an attribute `value` back into a property value of the declared `type`
 * (Req 7.2). Falls back to the type default when the value is absent (`null`) or does
 * not parse.
 *
 * - `boolean`: present (any non-null value) -> `true`, absent (`null`) -> `false`.
 * - `number`: `Number(value)`, falling back to `0` when absent or `NaN`.
 * - `string`: the value unchanged, falling back to `''` when absent.
 */
export function attributeToProp(value: string | null, type: ReflectedPropType): ReflectedPropValue {
  switch (type) {
    case 'boolean':
      // Presence semantics: any present value decodes to true, an absent attribute to false.
      return value !== null;
    case 'number': {
      if (value === null) {
        return TYPE_DEFAULTS.number;
      }
      const parsed = Number(value);
      // Fall back to the default when the string does not parse to a finite number.
      return Number.isNaN(parsed) ? TYPE_DEFAULTS.number : parsed;
    }
    case 'string':
    default:
      return value ?? TYPE_DEFAULTS.string;
  }
}
