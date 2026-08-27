/**
 * `playerstack-top-state` — the top status-message region (Req 1.4, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it only reflects state: it consumes the shared store and i18n, and
 * never touches the media element or dispatches requests. It renders a `part="top-state"`
 * region with a `part="top-state-message"` text node. On a kernel error it surfaces a
 * localized "playback stuck" message from `getTranslations(language)` (Req 1.4) and reflects
 * `data-active` on the host (Req 3.3) so the Style_Layer can show/hide the region; otherwise
 * the region stays empty and inactive.
 *
 * The message language is configurable through the `language` attribute (defaulting to `en`);
 * changing it re-resolves the translations and repaints the current message text.
 */
import type { TopStateDefaultLanguage, TopStatePart } from '@typings/ui/playerstack-top-state.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { getTranslations } from '@i18n/index';

/** Default language applied when no `language` attribute is provided (Req 1.4). */
const DEFAULT_LANGUAGE: TopStateDefaultLanguage = 'en';

export class PlayerstackTopState extends PlayerstackElement {
  /**
   * Declares `language` as an observed attribute so the message language is configurable via
   * markup (Req 1.4). Driving `observedAttributes` from the schema keeps it the single source
   * of truth.
   */
  static override attributeSchema = {
    language: { attribute: 'language', type: 'string' },
  } as const;

  /** Resolved translations for the current language; re-resolved on attribute change. */
  private translations: Translations = getTranslations(DEFAULT_LANGUAGE);

  /** Whether the store currently reports a kernel error, i.e. a message should be shown. */
  private hasError = false;

  /** The rendered region container; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /** The rendered message text region; updated with the localized status message. */
  private messageRegion: HTMLElement | null = null;

  /**
   * Tracks whether the store reports a kernel error and repaints the localized message. Only
   * the single field this element cares about is read, per the base class's opt-in
   * `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.hasError = state.kernelError !== null && state.kernelError !== undefined;
    this.updateMessage();
  }

  /**
   * Re-resolves the translations when the `language` attribute changes and repaints the
   * current message so the region reflects the new language immediately.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
      this.updateMessage();
    }
  }

  /**
   * Writes the localized status message into the `part="top-state-message"` region and
   * reflects `data-active` on the host when a message is showing (Req 3.3). Guards for the
   * pre-render window: if called before `render` created the region, the paint is skipped and
   * `render` repaints from the latest state on connect.
   */
  private updateMessage(): void {
    if (this.messageRegion === null) {
      return;
    }
    const message = this.hasError ? (this.translations.playbackStuckClickResumePlayback ?? '') : '';
    this.messageRegion.textContent = message;
    this.reflectState({ active: message !== '' });
  }

  /**
   * Builds the Markup_Contract: a `part="top-state"` region holding a
   * `part="top-state-message"` text region. Nodes are created and APPENDED (never via
   * `innerHTML`) so the adopted Style_Layer — in the fallback path an injected `<style>` — is
   * preserved. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    // Seed translations from any `language` attribute set before connect.
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    const containerPart: TopStatePart = 'top-state';
    const container = document.createElement('div');
    container.setAttribute('part', containerPart);

    const messagePart: TopStatePart = 'top-state-message';
    const messageRegion = document.createElement('div');
    messageRegion.setAttribute('part', messagePart);

    container.appendChild(messageRegion);

    this.container = container;
    this.messageRegion = messageRegion;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Paint from whatever state the store has already delivered (if the context resolved
    // before render ran).
    const state = this.store?.getState();
    if (state !== undefined) {
      this.hasError = state.kernelError !== null && state.kernelError !== undefined;
    }
    this.updateMessage();
  }
}
