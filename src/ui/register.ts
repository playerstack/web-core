import type { PlayerstackElementDefinition } from '@typings/ui/register.types';
import { PLAYERSTACK_ELEMENTS } from '@ui/element-registry';

/**
 * Idempotently defines every Playerstack UI_Element in a `CustomElementRegistry`
 * under its `playerstack-` prefixed name (Req 1.2).
 *
 * WHY the `registry.get(name)` guard: `CustomElementRegistry.define` throws a
 * `NotSupportedError` when a name is already defined. Skipping already-defined
 * names (instead of letting `define` throw) lets a consumer call this function
 * more than once — or across multiple bundles that each ship Core — without
 * crashing, and still registers any remaining not-yet-defined elements (Req 1.3).
 *
 * WHY `registry` is a parameter: injecting the registry keeps the function pure
 * with respect to globals so tests can pass a jsdom `customElements` or a fake
 * registry instead of mutating the real global one.
 */
export function registerPlayerstackElements(
  registry: CustomElementRegistry = globalThis.customElements,
  defs: readonly PlayerstackElementDefinition[] = PLAYERSTACK_ELEMENTS,
): void {
  for (const { name, ctor } of defs) {
    if (registry.get(name)) continue; // Req 1.3: skip re-definition, continue with the rest.
    registry.define(name, ctor);
  }
}
