/**
 * `playerstack-nav-buttons` — the previous/next navigation cluster control (Req 1.4, 1.5,
 * 2.1, 5.1, 5.3, 21.1).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element or a playlist directly. A click on the previous button emits a
 * `playerstack-prev-request` DOM event and a click on the next button emits a
 * `playerstack-next-request` DOM event that the surrounding application/adapter (wired
 * through the `MediaController`) fulfils (Req 2.1). This mirrors the reactjs skin's
 * `showNavButtons` prev/next affordance without coupling Core to any playlist model.
 *
 * WHY these request types are not in the core `RequestEventName` set: playlist navigation is
 * an application concern that not every adapter implements, so the prev/next requests are
 * adapter-extensible custom events rather than part of the fixed core request vocabulary.
 * They still ride the same bubbling + composed `dispatchRequest` channel, so an application
 * that opts in listens for them exactly like a core request.
 *
 * Visibility is intentionally left to the host/consumer: the reactjs skin controls whether
 * the cluster shows via `showNavButtons`, so Core simply renders the element and lets the
 * consumer toggle it through a reflected `data-*`/CSS attribute. Keeping visibility out of
 * the element avoids duplicating skin-level policy here (minimal by design).
 *
 * Accessibility (Req 1.5): each rendered `<button>` carries the implicit ARIA `button` role,
 * and its accessible name is configurable through the `prev-label` / `next-label`
 * attributes. When the consumer omits them, the default English labels apply.
 */
import type { NavPrevDefaultLabel, NavNextDefaultLabel } from '@typings/ui/playerstack-nav-buttons.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { previousTrackIcon, nextTrackIcon } from '@icons/index';

/** Default accessible name used when no `prev-label` attribute is provided (Req 1.5). */
const DEFAULT_PREV_LABEL: NavPrevDefaultLabel = 'Previous';

/** Default accessible name used when no `next-label` attribute is provided (Req 1.5). */
const DEFAULT_NEXT_LABEL: NavNextDefaultLabel = 'Next';

export class PlayerstackNavButtons extends PlayerstackElement {
  /**
   * Declares the per-button `prev-label` / `next-label` accessible-name attributes as
   * observed so each button's name is configurable via markup (Req 1.5). Keying the schema
   * by readable prop names while mapping to the concrete attribute names drives
   * `observedAttributes` from the schema.
   */
  static override attributeSchema = {
    prevLabel: { attribute: 'prev-label', type: 'string' },
    nextLabel: { attribute: 'next-label', type: 'string' },
  } as const;

  /** The rendered container element; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /**
   * Builds the Markup_Contract: a `part="nav-buttons"` container holding a
   * `part="prev-button"` and a `part="next-button"` `<button>`, each with its own icon glyph
   * span. Nodes are created and APPENDED (never via `innerHTML`) so the Style_Layer the base
   * class adopted before `render` — in the fallback path an injected `<style>` — is
   * preserved. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('part', 'nav-buttons');

    const prevButton = document.createElement('button');
    prevButton.setAttribute('part', 'prev-button');
    prevButton.setAttribute('type', 'button');
    // The accessible name comes from the host's `prev-label` when set, else the default
    // (Req 1.5). `<button>` already carries the implicit ARIA `button` role.
    prevButton.setAttribute('aria-label', this.getAttribute('prev-label') ?? DEFAULT_PREV_LABEL);
    const iconPrev = document.createElement('span');
    iconPrev.className = 'icon icon-prev';
    // Inject the real SVG glyph into the span's OWN innerHTML (safe: the serializer escapes
    // attribute values). The span belongs to this element, not the shadow root, so the adopted
    // Style_Layer survives. The `icon-prev` class name is kept for Style_Layer targeting.
    iconPrev.innerHTML = renderSvgFromDescriptor(previousTrackIcon);
    prevButton.appendChild(iconPrev);

    const nextButton = document.createElement('button');
    nextButton.setAttribute('part', 'next-button');
    nextButton.setAttribute('type', 'button');
    nextButton.setAttribute('aria-label', this.getAttribute('next-label') ?? DEFAULT_NEXT_LABEL);
    const iconNext = document.createElement('span');
    iconNext.className = 'icon icon-next';
    iconNext.innerHTML = renderSvgFromDescriptor(nextTrackIcon);
    nextButton.appendChild(iconNext);

    // Emit prev/next intent via request events; each button maps to its own request (Req 2.1).
    const onPrev = (): void => this.dispatchRequest('playerstack-prev-request');
    const onNext = (): void => this.dispatchRequest('playerstack-next-request');
    prevButton.addEventListener('click', onPrev);
    nextButton.addEventListener('click', onNext);
    // Deterministic cleanup: drop the listeners on disconnect (paired with the base class).
    this.addDisposer(() => prevButton.removeEventListener('click', onPrev));
    this.addDisposer(() => nextButton.removeEventListener('click', onNext));

    container.appendChild(prevButton);
    container.appendChild(nextButton);

    this.container = container;
    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);
  }
}
