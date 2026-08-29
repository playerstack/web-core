/**
 * `playerstack-title` — the media-title read-out shown inline in the control bar (Req 10.1,
 * 10.2, 10.3).
 *
 * The title is reusable player UI, so per A2 it lives in Core as a Custom Element (with its
 * `[part]` in the Style_Layer and its entry in `UI_ELEMENT_BINDINGS`) rather than as skin
 * markup, so every skin can reuse it instead of re-emitting the same `<div>`.
 *
 * As a display UI_Element it only reflects a consumer-provided string: it writes the title text
 * into a `part="title"` node and never touches the media element, reads the store, or dispatches
 * requests. The text is a static content input the consumer supplies (not playback state), so it
 * is configurable through the `title` attribute (defaulting to an empty string); changing the
 * attribute repaints the read-out. An absent attribute decodes to `''`, so removing it clears the
 * text gracefully.
 */
import type { TitlePart } from '@typings/ui/playerstack-title.types';
import { PlayerstackElement } from '@ui/playerstack-element';

export class PlayerstackTitle extends PlayerstackElement {
  /**
   * Declares `title` as an observed attribute so the displayed text is configurable via markup
   * (Req 10.3). Driving `observedAttributes` from the schema keeps it the single source of truth.
   */
  static override attributeSchema = {
    title: { attribute: 'title', type: 'string' },
  } as const;

  /** The rendered title text node; kept so `render` stays idempotent across reconnects. */
  private titleNode: HTMLElement | null = null;

  /**
   * Repaints the title when the `title` attribute changes so the read-out reflects the new value
   * immediately (Req 10.2). A removed attribute decodes to `''` (the string default), clearing the
   * text without special-casing.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'title' && typeof value === 'string') {
      this.paint(value);
    }
  }

  /**
   * Writes the title string into the `part="title"` node. Guards for the pre-render window: if
   * called before `render` created the node, the paint is skipped and `render` seeds the text from
   * the current attribute on connect.
   */
  private paint(title: string): void {
    if (this.titleNode === null) {
      return;
    }
    this.titleNode.textContent = title;
  }

  /**
   * Builds the Markup_Contract: a single `part="title"` node holding the title text. The node is
   * created and APPENDED (never via `innerHTML`) so the globally injected Style_Layer is
   * preserved. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.titleNode !== null) {
      return;
    }

    const titlePart: TitlePart = 'title';
    const titleNode = document.createElement('div');
    titleNode.setAttribute('part', titlePart);
    // Seed from any `title` attribute set before connect so the first paint is correct.
    titleNode.textContent = this.getAttribute('title') ?? '';

    this.titleNode = titleNode;

    // Append (never clobber) so the globally injected Style_Layer survives.
    this.root.appendChild(titleNode);
  }
}
