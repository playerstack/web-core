/**
 * `playerstack-fullscreen-button` — the enter/exit fullscreen toggle control
 * (Req 1.4, 1.5, 2.1, 3.3, 5.1, 5.3).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element or the Fullscreen API directly. A click emits a
 * `playerstack-enter-fullscreen-request` or `playerstack-exit-fullscreen-request` DOM event
 * that a fullscreen-capable adapter (wired through the `MediaController`) fulfils (Req 2.1).
 *
 * WHY these request types are not in the core `RequestEventName` set: fullscreen is a
 * presentation concern that not every adapter implements, so the enter/exit fullscreen
 * requests are adapter-extensible custom events rather than part of the fixed core request
 * vocabulary. They still ride the same bubbling + composed `dispatchRequest` channel, so an
 * adapter that opts in listens for them exactly like a core request.
 *
 * Fullscreen state flows back through the shared store; the button reflects it as
 * `data-fullscreen` on its host so the Style_Layer can swap the enter/exit glyph through its
 * `[part='fullscreen-button'][data-fullscreen] .icon-enter-fullscreen` selectors (Req 3.3).
 *
 * Accessibility (Req 1.5): the rendered `<button>` carries the implicit ARIA `button` role,
 * and its accessible name is configurable through the `aria-label` attribute. When the
 * consumer omits it, the default English label applies.
 */
import type { FullscreenButtonDefaultLabel } from '@typings/ui/playerstack-fullscreen-button.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { fullscreenIcon, unfullscreenIcon } from '@icons/index';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: FullscreenButtonDefaultLabel = 'Fullscreen';

export class PlayerstackFullscreenButton extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the accessible name is configurable
   * via markup (Req 1.5). Keying the schema by `label` while mapping to the `aria-label`
   * attribute keeps the prop name readable and drives `observedAttributes` from the schema.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
  } as const;

  /**
   * Latest `isFullScreen` value mirrored from the store. The click handler reads it to
   * decide whether the interaction expresses an enter or an exit intent (Req 2.1) without
   * querying the Fullscreen API.
   */
  private fullscreen = false;

  /** The rendered button element; kept so `render` stays idempotent across reconnects. */
  private button: HTMLButtonElement | null = null;

  /**
   * Reflects the latest fullscreen state to `data-fullscreen` on the host (Req 3.3) and
   * tracks it for the click handler's enter/exit decision. Only the single field this
   * element cares about is reflected, per the base class's opt-in `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.fullscreen = state.isFullScreen;
    this.reflectState({ fullscreen: state.isFullScreen });
  }

  /**
   * Builds the Markup_Contract: a `part="fullscreen-button"` `<button>` holding the enter
   * and exit glyph spans the Style_Layer toggles by reflected state. Nodes are created and
   * APPENDED (never via `innerHTML`) so the Style_Layer the base class adopted before
   * `render` — in the fallback path an injected `<style>` — is preserved. A guard keeps
   * `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.button !== null) {
      return;
    }

    const button = document.createElement('button');
    button.setAttribute('part', 'fullscreen-button');
    button.setAttribute('type', 'button');
    // The accessible name comes from the host's `aria-label` when set, else the default
    // (Req 1.5). `<button>` already carries the implicit ARIA `button` role.
    button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    // Enter/exit glyphs: class names match the Style_Layer selectors that hide the inactive
    // glyph based on the reflected `data-fullscreen` state (Req 3.3).
    const iconEnter = document.createElement('span');
    iconEnter.className = 'icon icon-enter-fullscreen';
    // Inject the real SVG glyph into each span's OWN innerHTML (safe: the serializer escapes
    // attribute values). The spans belong to this element, not the shadow root, so the adopted
    // Style_Layer survives. The `icon-*` classes are kept so the state toggle still swaps them.
    iconEnter.innerHTML = renderSvgFromDescriptor(fullscreenIcon);
    const iconExit = document.createElement('span');
    iconExit.className = 'icon icon-exit-fullscreen';
    iconExit.innerHTML = renderSvgFromDescriptor(unfullscreenIcon);
    button.appendChild(iconEnter);
    button.appendChild(iconExit);

    // Emit intent via a request event; the current fullscreen state decides which (Req 2.1).
    const onClick = (): void => {
      if (this.fullscreen) {
        this.dispatchRequest('playerstack-exit-fullscreen-request');
      } else {
        this.dispatchRequest('playerstack-enter-fullscreen-request');
      }
    };
    button.addEventListener('click', onClick);
    // Deterministic cleanup: drop the listener on disconnect (paired with the base class).
    this.addDisposer(() => button.removeEventListener('click', onClick));

    this.button = button;
    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(button);
  }
}
