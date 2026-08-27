import type { AttributeSchemaEntry } from '@typings/ui/playerstack-element.types';

/**
 * The value type produced when reading a property from a Custom Element,
 * matching the declared `type` field of an `AttributeSchemaEntry`.
 */
export type ReflectedPropValue = string | number | boolean;

/**
 * Signature for converting a property value into its serialized attribute
 * form. Returns `null` when the attribute should be removed.
 */
export type PropToAttribute = (value: ReflectedPropValue, type: AttributeSchemaEntry['type']) => string | null;

/**
 * Signature for parsing a serialized attribute value back into its property
 * value, respecting the declared attribute `type`.
 */
export type AttributeToProp = (value: string | null, type: AttributeSchemaEntry['type']) => ReflectedPropValue;
