/**
 * Category a Design_Token belongs to. Drives the CSS_Custom_Property prefix
 * segment (`--playerstack-<category>-<name>`) (Req 4.1, 4.2).
 */
export type TokenCategory = 'color' | 'space' | 'font' | 'radius';

/**
 * A single Design_Token: a structured design datum (color, spacing, typography
 * or radius) compiled to a CSS_Custom_Property (Req 4.1).
 */
export interface DesignToken {
  /** Token category (e.g. 'color', 'space', 'font', 'radius'). */
  category: TokenCategory;
  /** Token name within its category (e.g. 'accent', 'md', 'family-base'). */
  name: string;
  /** Resolved value (e.g. '#ff375f', '8px', 'sans-serif', '4px'). */
  value: string;
}

/**
 * Immutable set of Design_Tokens. Single source of truth compiled to the
 * `--playerstack-*` CSS_Custom_Properties (Req 4.1).
 */
export type DesignTokenSet = readonly DesignToken[];
