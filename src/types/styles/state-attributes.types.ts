/**
 * Map of `data-*` attribute name to its reflected string value, or `null` to
 * signal the attribute should be removed. Produced by
 * `reflectStateToAttributes` (Req 3.3, 13.3, 20.2).
 */
export interface AttributeReflection {
  [dataAttribute: `data-${string}`]: string | null;
}

/**
 * Serializable UI_Element state that can be reflected to `data-*` attributes.
 * Values are limited to the primitive types that round-trip through attributes
 * (Req 3.3, 13.3, 20.2).
 */
export type ReflectableState = Record<string, string | number | boolean | null>;
