/**
 * `playerstack-play-button` — the play/pause toggle control (Req 1.4, 2.1, 3.3, 5.1, 5.3).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element directly. A click emits a `playerstack-play-request` or
 * `playerstack-pause-request` DOM event that the `MediaController` routes to the
 * `PlayerAdapter` (Req 2.1). Playback state flows back through the shared store; the button
 * reflects it as `data-playing` on its host so the Style_Layer can swap the play/pause glyph
 * through its `[part='play-button'][data-playing] .icon-play` selectors (Req 3.3).
 *
 * Accessibility (Req 1.5): the rendered `<button>` carries the implicit ARIA `button` role,
 * and its accessible name is configurable through the `aria-label` attribute. When the
 * consumer omits it, the default English label applies.
 */
import type { PlayButtonDefaultLabel } from '@typings/ui/playerstack-play-button.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { playIcon, pauseIcon } from '@icons/index';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: PlayButtonDefaultLabel = 'Play';

export class PlayerstackPlayButton extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the accessible name is configurable
   * via markup (Req 1.5). Keying the schema by `label` while mapping to the `aria-label`
   * attribute keeps the prop name readable and drives `observedAttributes` from the schema.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
  } as const;

  /**
   * Latest `playing` value mirrored from the store. The click handler reads it to decide
   * whether the interaction expresses a play or a pause intent (Req 2.1) without querying
   * the media element.
   */
  private playing = false;

  /** The rendered button element; kept so `render` stays idempotent across reconnects. */
  private button: HTMLButtonElement | null = null;

  /**
   * Reflects the latest `playing` state to `data-playing` on the host (Req 3.3) and tracks
   * it for the click handler's play/pause decision. Only the single field this element cares
   * about is reflected, per the base class's opt-in `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.playing = state.playing;
    this.reflectState({ playing: state.playing });
  }

  /**
   * Builds the Markup_Contract: a `part="play-button"` `<button>` holding the play and pause
   * glyph spans the Style_Layer toggles by reflected state. Nodes are created and APPENDED
   * (never via `innerHTML`) so the Style_Layer the base class adopted before `render` — in
   * the fallback path an injected `<style>` — is preserved. A guard keeps `render`
   * idempotent across reconnects.
   */
  protected render(): void {
    if (this.button !== null) {
      return;
    }

    const button = document.createElement('button');
    button.setAttribute('part', 'play-button');
    button.setAttribute('type', 'button');
    // The accessible name comes from the host's `aria-label` when set, else the default
    // (Req 1.5). `<button>` already carries the implicit ARIA `button` role.
    button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    // Play/pause glyphs: class names match the Style_Layer selectors that hide the
    // inactive glyph based on the reflected `data-playing` state (Req 3.3).
    const iconPlay = document.createElement('span');
    iconPlay.className = 'icon icon-play';
    // Inject the real SVG glyph into the span's OWN innerHTML (safe: the serializer escapes
    // attribute values). The span node belongs to this element, not the shadow root, so the
    // adopted Style_Layer / fallback `<style>` is untouched. The `icon-play` class is kept so
    // the Style_Layer's state toggle keeps hiding/showing the glyph.
    iconPlay.innerHTML = renderSvgFromDescriptor(playIcon);
    const iconPause = document.createElement('span');
    iconPause.className = 'icon icon-pause';
    iconPause.innerHTML = renderSvgFromDescriptor(pauseIcon);
    button.appendChild(iconPlay);
    button.appendChild(iconPause);

    // Emit intent via a request event; the current `playing` state decides which (Req 2.1).
    const onClick = (): void => {
      if (this.playing) {
        this.dispatchRequest('playerstack-pause-request');
      } else {
        this.dispatchRequest('playerstack-play-request');
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
