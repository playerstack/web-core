/**
 * Pure, deterministic helpers that map PlayerStack Design_Tokens to their
 * `--playerstack-<category>-<name>` CSS_Custom_Property names and compile a full
 * token set into a CSS block (Req 4.2, 4.4, 4.5, 13.1).
 *
 * `tokenToCssVarName` and `cssVarNameToTokenId` are exact inverses for valid tokens,
 * which is what enables the token<->variable roundtrip property (Req 4.5, 20.1). To
 * keep the inverse unambiguous even though a token `name` may itself contain hyphens
 * (e.g. `family-base`, `track-buffered`), the variable name is structured as a known
 * fixed prefix, then the category (which never contains a hyphen), then the name. The
 * parser therefore splits on the FIRST hyphen after the prefix.
 */
import type { DesignToken, DesignTokenSet } from '@typings/styles/tokens.types';
import type { TokenId } from '@typings/styles/token-css.types';

/**
 * Fixed prefix shared by every PlayerStack CSS_Custom_Property. Kept as a constant so the
 * forward mapping and its inverse can never drift apart.
 */
const VAR_PREFIX = '--playerstack-';

/**
 * Maps a token identifier to its `--playerstack-<category>-<name>` CSS_Custom_Property
 * name. Pure and deterministic: the same `{ category, name }` always yields the same
 * string (Req 4.2, 4.5).
 */
export function tokenToCssVarName(token: TokenId): string {
  return `${VAR_PREFIX}${token.category}-${token.name}`;
}

/**
 * Parses a `--playerstack-<category>-<name>` CSS_Custom_Property name back into its
 * token identifier. Exact inverse of `tokenToCssVarName` for valid tokens (Req 4.5).
 *
 * The known prefix is stripped first, then the string is split on the FIRST hyphen:
 * the leading segment is the `category` (categories never contain a hyphen) and the
 * REST is the `name` (which may contain hyphens). This keeps the parse unambiguous.
 *
 * Invalid names are not silenced: a descriptive Error is thrown when the name does not
 * start with the required prefix or lacks a category segment (see task 2.5).
 */
export function cssVarNameToTokenId(varName: string): TokenId {
  if (!varName.startsWith(VAR_PREFIX)) {
    throw new Error(`Invalid PlayerStack CSS variable "${varName}": expected it to start with "${VAR_PREFIX}".`);
  }

  const body = varName.slice(VAR_PREFIX.length);
  const firstHyphen = body.indexOf('-');

  // Need a category segment AND a name segment: a hyphen that is neither at the very
  // start (empty category) nor at the very end (empty name).
  if (firstHyphen <= 0 || firstHyphen >= body.length - 1) {
    throw new Error(
      `Invalid PlayerStack CSS variable "${varName}": expected the "${VAR_PREFIX}<category>-<name>" shape.`,
    );
  }

  const category = body.slice(0, firstHyphen) as DesignToken['category'];
  const name = body.slice(firstHyphen + 1);

  return { category, name };
}

/**
 * Compiles a Design_Token set into a CSS block that declares every token as a
 * `--playerstack-*` CSS_Custom_Property under `selector` (Req 4.2, 13.1).
 *
 * `selector` defaults to `:root` (global tokens); callers pass `:host` for tokens that
 * live inside a shadow root. Deterministic: token declaration order matches the input
 * array order so the same set always produces byte-identical output.
 */
export function compileTokensToCss(tokens: DesignTokenSet, selector = ':root'): string {
  const declarations = tokens.map((token) => `  ${tokenToCssVarName(token)}: ${token.value};`).join('\n');

  return `${selector} {\n${declarations}\n}\n`;
}
