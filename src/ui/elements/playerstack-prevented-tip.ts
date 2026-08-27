/**
 * `playerstack-prevented-tip` — the blocked-playback tip (Req 1.4, 3.3, 5.1, 5.3).
 *
 * Port of the original `PreventedTip` (Commons): it surfaces one of TWO tips in the top-left when
 * autoplay is blocked/prevented, plus (for the muted case) a full-stage transparent click-catcher
 * so a click anywhere resumes/unmutes:
 *
 *   1. STUCK tip — when `hasResource && prevented && currentTime === 0 && paused`: a pill with the
 *      PLAY glyph + the localized `playbackStuckClickResumePlayback` message. No click-catcher.
 *   2. CLICK-TO-UNMUTE tip — when `hasResource && prevented && !paused && muted && !preventedClicked`:
 *      a pill with the MUTED glyph + the localized `clickToUnmute` message, PLUS a full-stage
 *      `[part='prevented-tip-clicked']` overlay. A click on that overlay marks the tip clicked
 *      (so it never re-shows) and emits `playerstack-prevented-click` so the skin resumes/unmutes.
 *
 * As a display UI_Element it never touches the media element. The visibility inputs
 * (`hasResource`/`prevented`/`paused`/`muted`/`currentTime`) come from the consumer/skin through
 * the property channel (the store has no `prevented`/`hasResource` field), and the localized text
 * comes from `getTranslations(language)` (Req 1.4). It reflects `data-mode` (`stuck`/`unmute`/none)
 * on the host so the Style_Layer shows the right pill + the click-catcher only in the unmute case.
 */
import type { PreventedTipDefaultLanguage, PreventedTipPart } from '@typings/ui/playerstack-prevented-tip.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { getTranslations } from '@i18n/index';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { playIcon, mutedIcon } from '@icons/index';

/** Default language applied when no `language` attribute is provided (Req 1.4). */
const DEFAULT_LANGUAGE: PreventedTipDefaultLanguage = 'en';

/** The tip mode currently surfaced: the stuck tip, the click-to-unmute tip, or none. */
type PreventedTipMode = 'stuck' | 'unmute' | 'none';

export class PlayerstackPreventedTip extends PlayerstackElement {
  /**
   * Declares `language` as an observed attribute so the tip language is configurable via
   * markup (Req 1.4). Driving `observedAttributes` from the schema keeps it the single source
   * of truth.
   */
  static override attributeSchema = {
    language: { attribute: 'language', type: 'string' },
  } as const;

  /** Resolved translations for the current language; re-resolved on attribute change. */
  private translations: Translations = getTranslations(DEFAULT_LANGUAGE);

  // ─── Visibility inputs (property channel, set by the skin) ────────────────

  /** Whether a media resource is loaded (parity `hasResource`); both tips require it. */
  private _hasResource = false;

  /** Whether autoplay was blocked/prevented (parity `prevented`); both tips require it. */
  private _prevented = false;

  /** Whether playback is paused (parity `paused`). Drives which tip (stuck vs unmute). */
  private _paused = true;

  /** Whether the media is muted (parity `muted`). The unmute tip requires it. */
  private _muted = false;

  /** Current playback position in seconds (parity `currentTime`). The stuck tip needs `0`. */
  private _currentTime = 0;

  /**
   * Whether the user already dismissed the unmute tip by clicking (parity `preventedClicked`).
   * Once true the unmute tip never re-shows for this element instance.
   */
  private preventedClicked = false;

  // ─── Rendered nodes ───────────────────────────────────────────────────────

  /** The tip pill container; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /** The leading glyph span (play/muted); its SVG is swapped by mode. */
  private iconRegion: HTMLElement | null = null;

  /** The tip text region; updated with the localized tip per mode. */
  private messageRegion: HTMLElement | null = null;

  /** The full-stage transparent click-catcher (unmute case only). */
  private clickCatcher: HTMLElement | null = null;

  // ─── Public inputs ────────────────────────────────────────────────────────

  set hasResource(value: boolean) {
    this._hasResource = Boolean(value);
    this.updateTip();
  }
  get hasResource(): boolean {
    return this._hasResource;
  }

  set prevented(value: boolean) {
    this._prevented = Boolean(value);
    this.updateTip();
  }
  get prevented(): boolean {
    return this._prevented;
  }

  set paused(value: boolean) {
    this._paused = Boolean(value);
    this.updateTip();
  }
  get paused(): boolean {
    return this._paused;
  }

  set muted(value: boolean) {
    this._muted = Boolean(value);
    this.updateTip();
  }
  get muted(): boolean {
    return this._muted;
  }

  set currentTime(value: number) {
    this._currentTime = typeof value === 'number' ? value : 0;
    this.updateTip();
  }
  get currentTime(): number {
    return this._currentTime;
  }

  /**
   * Re-resolves the translations when the `language` attribute changes and repaints the tip so
   * the region reflects the new language immediately.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
      this.updateTip();
    }
  }

  /**
   * Computes the current tip mode from the inputs (parity with the original render branches):
   *   - `stuck`  when `hasResource && prevented && currentTime === 0 && paused`.
   *   - `unmute` when `hasResource && prevented && !paused && muted && !preventedClicked`.
   *   - `none`   otherwise.
   * The stuck branch is evaluated first (matches the original array order).
   */
  private computeMode(): PreventedTipMode {
    if (!this._hasResource || !this._prevented) {
      return 'none';
    }
    if (this._currentTime === 0 && this._paused) {
      return 'stuck';
    }
    if (!this._paused && this._muted && !this.preventedClicked) {
      return 'unmute';
    }
    return 'none';
  }

  /**
   * Paints the tip for the current mode: swaps the glyph (play/muted), writes the localized
   * message, toggles the click-catcher (unmute only), and reflects `data-mode`/`data-active` on
   * the host so the Style_Layer shows the right pieces (Req 3.3). Guards the pre-render window.
   */
  private updateTip(): void {
    if (this.messageRegion === null || this.iconRegion === null) {
      return;
    }
    const mode = this.computeMode();
    if (mode === 'stuck') {
      this.iconRegion.innerHTML = renderSvgFromDescriptor(playIcon);
      this.messageRegion.textContent = this.translations.playbackStuckClickResumePlayback ?? '';
    } else if (mode === 'unmute') {
      this.iconRegion.innerHTML = renderSvgFromDescriptor(mutedIcon);
      this.messageRegion.textContent = this.translations.clickToUnmute ?? '';
    } else {
      this.messageRegion.textContent = '';
    }
    if (this.clickCatcher !== null) {
      // The full-stage click-catcher only exists for the unmute case (parity).
      this.clickCatcher.style.display = mode === 'unmute' ? 'block' : 'none';
    }
    this.setAttribute('data-mode', mode);
    this.reflectState({ active: mode !== 'none' });
  }

  /**
   * Builds the Markup_Contract: a `part='prevented-tip'` pill holding a
   * `part='prevented-tip-icon'` glyph + a `part='prevented-tip-message'` text region, plus a
   * full-stage `part='prevented-tip-clicked'` click-catcher (hidden unless the unmute tip shows).
   * A click on EITHER the pill or the catcher marks the tip clicked and emits
   * `playerstack-prevented-click` (Request/Response, Req 2.1). Nodes are APPENDED (never via
   * `innerHTML` on the root) so the adopted Style_Layer survives; a guard keeps `render`
   * idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    // Seed translations from any `language` attribute set before connect.
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    // Full-stage transparent click-catcher (appended FIRST so it sits behind the pill).
    const clickedPart: PreventedTipPart = 'prevented-tip-clicked';
    const clickCatcher = document.createElement('div');
    clickCatcher.setAttribute('part', clickedPart);
    clickCatcher.style.display = 'none';

    const containerPart: PreventedTipPart = 'prevented-tip';
    const container = document.createElement('div');
    container.setAttribute('part', containerPart);

    const iconPart: PreventedTipPart = 'prevented-tip-icon';
    const iconRegion = document.createElement('span');
    iconRegion.setAttribute('part', iconPart);
    iconRegion.className = 'icon';

    const messagePart: PreventedTipPart = 'prevented-tip-message';
    const messageRegion = document.createElement('div');
    messageRegion.setAttribute('part', messagePart);

    container.appendChild(iconRegion);
    container.appendChild(messageRegion);

    // A click on the pill or the catcher expresses the user's "resume/unmute" intent: mark the
    // tip clicked (so the unmute tip never re-shows) and dispatch the request (Req 2.1).
    const onClick = (): void => {
      this.preventedClicked = true;
      this.dispatchRequest('playerstack-prevented-click');
      this.updateTip();
    };
    clickCatcher.addEventListener('click', onClick);
    this.addDisposer(() => clickCatcher.removeEventListener('click', onClick));
    container.addEventListener('click', onClick);
    this.addDisposer(() => container.removeEventListener('click', onClick));

    this.container = container;
    this.iconRegion = iconRegion;
    this.messageRegion = messageRegion;
    this.clickCatcher = clickCatcher;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(clickCatcher);
    this.root.appendChild(container);

    this.updateTip();
  }
}
