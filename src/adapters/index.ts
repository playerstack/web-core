/**
 * Public barrel for the `@playerstack/core/adapters/framework` subpath (Req 8.1, 11.1).
 *
 * Re-exports the framework-agnostic adapter surface a framework binding needs:
 * the reference DOM-backed `domFrameworkAdapter`, the `UI_ELEMENT_BINDINGS` table
 * that describes every UI_Element, and the public types that describe the contract.
 * Both the React_Adapter and a future Vue_Adapter build on this same contract.
 * Value re-exports use `export`; type-only re-exports use `export type`.
 */

// Reference DOM adapter and the complete UI_Element binding table.
export { domFrameworkAdapter, UI_ELEMENT_BINDINGS } from '@adapters/framework-adapter';

// Public types.
export type { FrameworkAdapterContract, UiElementBinding } from '@typings/adapters/framework-adapter.types';
