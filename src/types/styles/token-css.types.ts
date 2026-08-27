import type { DesignToken, DesignTokenSet } from '@typings/styles/tokens.types';

/**
 * Identifier of a Design_Token, i.e. the `{ category, name }` pair that
 * uniquely locates a token independently of its value. Produced by
 * `cssVarNameToTokenId` and accepted by `tokenToCssVarName` (Req 4.5, 20.1).
 */
export interface TokenId {
  /** Token category segment of the CSS_Custom_Property name. */
  category: DesignToken['category'];
  /** Token name segment of the CSS_Custom_Property name. */
  name: string;
}

/**
 * Maps a token identifier to its `--playerstack-<category>-<name>`
 * CSS_Custom_Property name. Pure and deterministic (Req 4.2, 4.5, 20.1).
 */
export type TokenToCssVarName = (token: TokenId) => string;

/**
 * Parses a `--playerstack-<category>-<name>` CSS_Custom_Property name back into
 * its token identifier. Inverse of `tokenToCssVarName` (Req 4.5, 20.1).
 */
export type CssVarNameToTokenId = (varName: string) => TokenId;

/**
 * Compiles a full Design_Token set into a CSS block that declares every token
 * as a `--playerstack-*` CSS_Custom_Property under the given selector
 * (defaults to `:root`/`:host`) (Req 4.2, 13.1).
 */
export type CompileTokensToCss = (tokens: DesignTokenSet, selector?: string) => string;
