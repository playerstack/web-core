import type { MediaStoreState } from '@typings/ui/media-store.types';

/**
 * Describes a single attribute in a PlayerstackElement's attribute schema.
 * Drives `observedAttributes` derivation and prop <-> attribute reflection.
 */
export interface AttributeSchemaEntry {
  /** HTML attribute name (kebab-case). */
  attribute: string;
  /** Declared value type used by the reflection helpers. */
  type: 'string' | 'number' | 'boolean';
  /** When true, property changes reflect back to the attribute. */
  reflect?: boolean;
}

/**
 * Immutable map of property key -> attribute schema entry for a UI_Element.
 */
export type AttributeSchema = Readonly<Record<string, AttributeSchemaEntry>>;

/**
 * Contract for a UI_Element that consumes shared media context state.
 * Implemented by `PlayerstackElement`; subclasses override `onStoreChange`.
 */
export interface MediaContextConsumer {
  onStoreChange(state: Readonly<MediaStoreState>): void;
}
