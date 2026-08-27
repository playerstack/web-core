/**
 * `playerstack-icon` — renders an icon from an `IconDescriptor` as an inline SVG (Req 1.4,
 * 5.1, 5.3).
 *
 * As a presentational UI_Element it holds no media state: it neither consumes the store nor
 * dispatches requests. The consumer/Skin supplies the icon shape through the `icon` property
 * and, optionally, sizing through the `size` property or the `width`/`height` attributes. The
 * element serializes the descriptor with the SAME pure `renderSvgFromDescriptor` serializer
 * the rest of Core uses (Req 1.4) so the emitted SVG stays deterministic and consistent with
 * the headless layer.
 *
 * WHY the wrapper's `innerHTML` is set instead of the shadow root's:
 *   The SVG markup comes from the pure serializer (its attribute values are escaped), so
 *   assigning it as `innerHTML` is safe HERE. But the base class adopts the Style_Layer — in
 *   the fallback path an injected `<style>` — into the shadow root BEFORE `render` runs.
 *   Clobbering `this.root.innerHTML` would wipe that adopted style. So the element creates its
 *   OWN `part="icon"` wrapper `<span>`, appends it to the shadow root (preserving the style),
 *   and only ever writes the serialized SVG into the WRAPPER's `innerHTML`. A guard keeps
 *   `render` idempotent across reconnects.
 *
 * On `icon`/`size` assignment (and on `width`/`height` attribute changes) after render, only
 * the wrapper's `innerHTML` is re-serialized so the adopted style survives every repaint.
 */
import type { IconDescriptor } from '@typings/icons.types';
import type { RenderSvgOptions } from '@typings/ui/icon-render.types';
import type { AttributeSchema } from '@typings/ui/playerstack-element.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { renderSvgFromDescriptor } from '@ui/icon-render';

export class PlayerstackIcon extends PlayerstackElement {
  /**
   * Observed attributes so a plain-HTML consumer can size the icon declaratively
   * (`width`/`height`) without touching the `size` property. Both are `string` so CSS-length
   * values (e.g. `1em`) pass through unchanged; `onAttributeChanged` re-serializes on change.
   */
  static override attributeSchema: AttributeSchema = {
    width: { attribute: 'width', type: 'string' },
    height: { attribute: 'height', type: 'string' },
  };

  /** The descriptor to serialize; `null` until a consumer assigns one via `icon`. */
  private _icon: IconDescriptor | null = null;

  /** Optional sizing forwarded to the serializer; merged from the `size` prop and attributes. */
  private _size: RenderSvgOptions = {};

  /** The rendered wrapper `<span>`; kept so `render` stays idempotent and repaints target it. */
  private wrapper: HTMLSpanElement | null = null;

  /**
   * Public setter to supply the icon descriptor. Assigning re-serializes the wrapper's
   * `innerHTML` immediately so the icon reflects the new descriptor without waiting for any
   * external trigger.
   */
  set icon(descriptor: IconDescriptor | null) {
    this._icon = descriptor;
    this.paint();
  }

  get icon(): IconDescriptor | null {
    return this._icon;
  }

  /**
   * Public setter to supply optional sizing (`width`/`height`). Assigning re-serializes the
   * wrapper so the SVG picks up the new dimensions immediately.
   */
  set size(options: RenderSvgOptions | null) {
    this._size = options ?? {};
    this.paint();
  }

  get size(): RenderSvgOptions {
    return this._size;
  }

  /**
   * Reacts to `width`/`height` attribute changes by merging the value into the tracked sizing
   * and re-serializing the wrapper. A `null` value (attribute removed) clears that dimension so
   * the SVG scales from its `viewBox` again.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey !== 'width' && propKey !== 'height') {
      return;
    }
    if (value === null || value === undefined || value === '') {
      delete this._size[propKey];
    } else {
      this._size[propKey] = value as string | number;
    }
    this.paint();
  }

  /**
   * Re-serializes the descriptor into the wrapper's `innerHTML` via the pure
   * `renderSvgFromDescriptor` (Req 1.4). Guards for the pre-render window (wrapper not built
   * yet) and for a missing descriptor (nothing to draw yet, so the wrapper is emptied). Only
   * the wrapper — the element's own node — is touched, never the shadow root, so the adopted
   * Style_Layer survives.
   */
  private paint(): void {
    if (this.wrapper === null) {
      return;
    }
    if (this._icon === null) {
      this.wrapper.innerHTML = '';
      return;
    }
    // Safe: the SVG string comes from the pure serializer (values escaped) and is written into
    // the element's OWN wrapper node, not the shadow root that holds the adopted style.
    this.wrapper.innerHTML = renderSvgFromDescriptor(this._icon, this._size);
  }

  /**
   * Builds the Markup_Contract: a single `part="icon"` wrapper `<span>` APPENDED to the shadow
   * root (never via `this.root.innerHTML`) so the adopted Style_Layer / fallback `<style>` is
   * preserved. A guard keeps `render` idempotent across reconnects; after appending, it paints
   * from whatever descriptor was assigned before connect.
   */
  protected render(): void {
    if (this.wrapper !== null) {
      return;
    }

    const wrapper = document.createElement('span');
    wrapper.setAttribute('part', 'icon');

    this.wrapper = wrapper;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(wrapper);

    // Paint from any descriptor assigned before the element connected.
    this.paint();
  }
}
