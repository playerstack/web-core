/**
 * Pure, deterministic serialization of an `IconDescriptor` to an SVG markup string
 * (Req 1.4, 13.1). No DOM access (`document.createElement` is intentionally NOT used):
 * the string is built manually so this module works in any environment (SSR, workers,
 * vanilla build) and stays framework-agnostic. No side-effects.
 *
 * The same descriptor + options always produces the exact same string, which is what
 * lets consumers (e.g. the `playerstack-icon` element) render icons deterministically
 * and makes the output snapshot-testable.
 *
 * ---
 * WHY attribute values are escaped:
 *
 * `IconDescriptor` values (`viewBox`, `fill`, element `attrs`, and the size options)
 * are treated as untrusted/dynamic input. If a value contained a `"`, `<`, `>` or `&`
 * it would break out of the attribute or the tag and produce malformed (or unsafe)
 * markup. `escapeAttr` neutralizes those characters so the serialized SVG is always
 * well-formed regardless of the input.
 */
import type { IconDescriptor, SvgElement } from '@typings/icons.types';
import type { RenderSvgOptions } from '@typings/ui/icon-render.types';

/**
 * Escapes the characters that are significant inside an XML/HTML double-quoted
 * attribute value: `&`, `<`, `>` and `"`. `&` is replaced first so the ampersands
 * introduced by the other replacements are not double-escaped.
 *
 * Numbers are coerced to their string form before escaping; a finite number never
 * contains a special character, but coercing here keeps the single code path.
 */
function escapeAttr(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Serializes a record of attributes to a ` key="value"` string, preserving the
 * caller's insertion order (`Object.keys` reflects insertion order for string keys).
 * Each value is escaped. A leading space is included per entry so the result can be
 * concatenated directly after the tag name.
 */
function serializeAttrs(attrs: Record<string, string | number>): string {
  return Object.keys(attrs)
    .map((key) => ` ${key}="${escapeAttr(attrs[key] as string | number)}"`)
    .join('');
}

/**
 * Recursively serializes a single `SvgElement` and its children.
 *
 * Leaf elements (no children) are self-closed (`<path d="..."/>`); elements WITH
 * children are emitted with an open/close pair (`<g ...>...</g>`) so nested content
 * is preserved.
 */
function serializeElement(element: SvgElement): string {
  const { tag, attrs, children } = element;
  const openTag = `<${tag}${serializeAttrs(attrs)}`;

  if (children && children.length > 0) {
    const inner = children.map(serializeElement).join('');
    return `${openTag}>${inner}</${tag}>`;
  }

  return `${openTag}/>`;
}

/**
 * Serializes an `IconDescriptor` to a complete `<svg>...</svg>` string, applying the
 * optional `RenderSvgOptions` sizing (Req 1.4, 13.1).
 *
 * The root `<svg>` always declares the SVG namespace and the descriptor's `viewBox`.
 * `fill` is added only when defined on the descriptor. `width`/`height` are added only
 * when provided in `opts` (numbers and strings are both rendered as their value);
 * absent size options are omitted entirely rather than emitted as empty attributes.
 */
export function renderSvgFromDescriptor(icon: IconDescriptor, opts?: RenderSvgOptions): string {
  const rootAttrs: Record<string, string | number> = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: icon.viewBox,
  };

  // Only reflect `fill` when the descriptor defines it, to avoid overriding CSS-driven
  // fill with an empty attribute.
  if (icon.fill !== undefined) {
    rootAttrs.fill = icon.fill;
  }

  // Size options are optional; omit them when absent so the SVG scales from its viewBox.
  if (opts?.width !== undefined) {
    rootAttrs.width = opts.width;
  }
  if (opts?.height !== undefined) {
    rootAttrs.height = opts.height;
  }

  const body = icon.elements.map(serializeElement).join('');

  return `<svg${serializeAttrs(rootAttrs)}>${body}</svg>`;
}
