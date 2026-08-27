/**
 * Public barrel for the `@playerstack/core/styles` subpath (Req 11.1).
 *
 * Re-exports the Design_Tokens, the pure token<->CSS-variable and
 * state<->attribute helpers, and the Style_Auto_Injection API, plus the public
 * types that describe them. Value re-exports use `export`; type-only re-exports
 * use `export type`.
 */

// Design_Tokens — single source of truth.
export { DESIGN_TOKENS } from '@styles/tokens';

// Pure token <-> CSS_Custom_Property helpers.
export { tokenToCssVarName, cssVarNameToTokenId, compileTokensToCss } from '@styles/token-css';

// Pure state <-> data-* attribute helpers.
export { reflectStateToAttributes, readStateFromAttributes } from '@styles/state-attributes';

// Style_Auto_Injection API.
export { ensurePlayerstackStyles, ensureGlobalTokens } from '@styles/style-injector';

// Public types.
export type { DesignToken, DesignTokenSet, TokenCategory } from '@typings/styles/tokens.types';
export type { TokenId } from '@typings/styles/token-css.types';
export type { AttributeReflection, ReflectableState } from '@typings/styles/state-attributes.types';
