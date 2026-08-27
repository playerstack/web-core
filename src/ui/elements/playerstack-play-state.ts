/**
 * `playerstack-play-state` — the center play-state overlay (Req 1.4, 3.3, 5.1, 5.3).
 *
 * It renders a big center affordance and, like `playerstack-play-button`, follows the
 * Request/Response model: a click NEVER touches the media element directly — it emits a
 * `playerstack-play-request` or `playerstack-pause-request` DOM event that the
 * `MediaController` routes to the `PlayerAdapter` (Req 2.1). Playback state flows back through
 * the shared store; the overlay reflects `data-playing`/`data-ended` on its host (Req 3.3) so
 * the Style_Layer can swap the big play / pause / replay glyph through its attribute
 * selectors.
 *
 * Accessibility (Req 1.5): the rendered `<button>` carries the implicit ARIA `button` role,
 * and its accessible name is configurable through the `aria-label` attribute; the default
 * English label applies when the consumer omits it.
 */
import type { PlayStateDefaultLabel, PlayStatePart } from '@typings/ui/playerstack-play-state.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { playIcon, pauseIcon, replayIcon } from '@icons/index';
import { mobilePlayIcon, mobilePauseIcon } from '@icons/mobile/index';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: PlayStateDefaultLabel = 'Play';

export class PlayerstackPlayState extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the accessible name is configurable via
   * markup (Req 1.5). Keying the schema by `label` while mapping to the `aria-label` attribute
   * keeps the prop name readable and drives `observedAttributes` from the schema.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
  } as const;

  /**
   * Latest `playing` value mirrored from the store. The click handler reads it to decide
   * whether the interaction expresses a play or a pause intent (Req 2.1) without querying the
   * media element.
   */
  private playing = false;

  /** The rendered button element; kept so `render` stays idempotent across reconnects. */
  private button: HTMLButtonElement | null = null;

  /**
   * Reflects the playing/ended state to `data-playing`/`data-ended` on the host (Req 3.3),
   * tracks `playing` for the click handler's play/pause decision, and derives a single
   * `data-showing` gate that the Style_Layer keys the center overlay's visibility off.
   *
   * WHY a derived `data-showing`: the original reactjs `PlayState` component only mounted the
   * big center affordance when `!loading && !buffering(waiting) && !kernelMsg && (paused ||
   * ended)` — it returned `null` while loading / on a kernel status message, and delegated the
   * `waiting` case to the spinner. `data-playing`/`data-ended` alone cannot express that (they
   * carry no loading/buffering/kernel info, and reflected booleans are always PRESENT as
   * `"true"`/`"false"` so a bare `[data-ended]` selector would match during playback). We
   * therefore compute the exact original `showing` predicate here and reflect it as
   * `data-showing` (`true` when it must show, else `null` so the attribute is ABSENT). This
   * keeps the element framework-agnostic (it only reflects a boolean derived from store state)
   * while letting the CSS hide the overlay — and stop intercepting clicks — during playback.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.playing = state.playing;
    // paused || ended, suppressed while loading/buffering or when a kernel status message is
    // active (mirrors the original component's early-returns). `null` removes the attribute.
    const showing =
      !state.isLoading && !state.isBuffering && state.kernelError == null && (state.playing === false || state.isEnded);
    this.reflectState({ playing: state.playing, ended: state.isEnded, showing: showing ? true : null });
  }

  /**
   * Builds the Markup_Contract: a `part="play-state"` overlay holding a
   * `part="play-state-button"` `<button>` with play/pause/replay glyph spans the Style_Layer
   * toggles by reflected state. Nodes are created and APPENDED (never via `innerHTML`) so the
   * adopted Style_Layer — in the fallback path an injected `<style>` — is preserved. A guard
   * keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.button !== null) {
      return;
    }

    const overlayPart: PlayStatePart = 'play-state';
    const overlay = document.createElement('div');
    overlay.setAttribute('part', overlayPart);

    const buttonPart: PlayStatePart = 'play-state-button';
    const button = document.createElement('button');
    button.setAttribute('part', buttonPart);
    button.setAttribute('type', 'button');
    // The accessible name comes from the host's `aria-label` when set, else the default
    // (Req 1.5). `<button>` already carries the implicit ARIA `button` role.
    button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    // Play / pause / replay glyphs: class names match the Style_Layer selectors that hide the
    // inactive glyphs based on the reflected `data-playing`/`data-ended` state (Req 3.3).
    const iconPlay = document.createElement('span');
    iconPlay.className = 'icon icon-play';
    // Inject the real SVG glyph into each span's OWN innerHTML (safe: the serializer escapes
    // attribute values). The spans belong to this element, not the shadow root, so the adopted
    // Style_Layer survives. The `icon-*` classes are kept so the state toggle still swaps them.
    iconPlay.innerHTML = renderSvgFromDescriptor(playIcon);
    const iconPause = document.createElement('span');
    iconPause.className = 'icon icon-pause';
    iconPause.innerHTML = renderSvgFromDescriptor(pauseIcon);
    const iconReplay = document.createElement('span');
    iconReplay.className = 'icon icon-replay';
    iconReplay.innerHTML = renderSvgFromDescriptor(replayIcon);
    // Mobile glyph variants (BOLDER/LARGER than the desktop play/pause per the original mobile
    // skin, which used `mobilePlayIcon`/`mobilePauseIcon` — 56-viewBox 8px bars vs the desktop
    // 36-viewBox 3px bars). Both sets are rendered; the Style_Layer shows the desktop glyphs by
    // default and swaps to these under `playerstack-media-controller[data-skin-mode='mobile']`,
    // keeping this element skin-agnostic (it only provides both, the CSS chooses). Ended still
    // uses the shared replay glyph (there is no mobile-specific replay icon).
    const iconPlayMobile = document.createElement('span');
    iconPlayMobile.className = 'icon icon-play-mobile';
    iconPlayMobile.innerHTML = renderSvgFromDescriptor(mobilePlayIcon);
    const iconPauseMobile = document.createElement('span');
    iconPauseMobile.className = 'icon icon-pause-mobile';
    iconPauseMobile.innerHTML = renderSvgFromDescriptor(mobilePauseIcon);
    button.appendChild(iconPlay);
    button.appendChild(iconPause);
    button.appendChild(iconReplay);
    button.appendChild(iconPlayMobile);
    button.appendChild(iconPauseMobile);

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

    overlay.appendChild(button);
    this.button = button;
    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(overlay);
  }
}
