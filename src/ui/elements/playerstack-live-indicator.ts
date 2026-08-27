/**
 * `playerstack-live-indicator` — the LIVE status badge: an at-edge dot + the "Live" label,
 * clickable to jump to the live edge (Req 1.4, 3.3, 5.1, 5.3). The behind-live NEGATIVE OFFSET
 * is NOT shown here — it lives in the time read-out (`playerstack-play-time`), matching the
 * monolith where the badge was just the dot + "Live". Showing it in both duplicated it on screen.
 *
 * WHY it does NOT own a controller like the ad overlay does:
 *   The headless `computeLiveDVRState`/`LiveDVRController` derive DVR state from a real
 *   `HTMLMediaElement`'s `seekable` TimeRanges (or a `DVRAdapter`), neither of which this
 *   UI_Element owns — the element lives inside the Shadow DOM and never touches the media
 *   element directly (Request/Response model, Req 2.1). So instead of instantiating a
 *   controller with an adapter it does not have, the element exposes a public `dvrState`
 *   setter that the adapter/consumer feeds from `computeLiveDVRState(mediaEl, config)` (or
 *   from a `LiveDVRController`'s `dvrStateChange` event) computed on the real media element.
 *
 * On each `dvrState` set the element reflects `data-live` (a usable DVR window is present) and
 * `data-at-edge` (currently at the live edge) onto the host so the Style_Layer paints the dot
 * (red at edge, grey behind) and the label state (Req 3.3). The offset text is not rendered here.
 *
 * Interaction (Req 2.1): clicking the indicator while behind live expresses a "jump to live"
 * intent as a `playerstack-seek-request` targeting `state.seekableEnd`; the `MediaController`
 * routes it to the `PlayerAdapter`. When already at the edge (or no DVR) the click is a no-op.
 */
import type { LiveIndicatorPart, LiveIndicatorDVRState } from '@typings/ui/playerstack-live-indicator.types';
import type { SeekRequestDetail } from '@typings/ui/media-controller.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { getTranslations } from '@i18n/index';

/** Default language applied when no `language` attribute is provided. */
const DEFAULT_LANGUAGE = 'en';

export class PlayerstackLiveIndicator extends PlayerstackElement {
  /**
   * Declares `language` as an observed attribute so the "Live" label is localizable via markup
   * (parity with the original mobile badge showing `i18n.live`).
   */
  static override attributeSchema = {
    language: { attribute: 'language', type: 'string' },
  } as const;

  /** Resolved translations for the "Live" label; re-resolved on language change. */
  private translations: Translations = getTranslations('en');

  /** The rendered indicator container; kept so `render` stays idempotent across reconnects. */
  private indicator: HTMLElement | null = null;

  /** The rendered "Live" label region (parity with the original badge text). */
  private label: HTMLElement | null = null;

  /**
   * The latest DVR state fed by the adapter/consumer, retained so a click can target the
   * current live edge (`seekableEnd`) even between renders.
   */
  private latestState: LiveIndicatorDVRState | null = null;

  /**
   * Public setter the adapter/consumer feeds from `computeLiveDVRState(mediaEl, config)` (or a
   * `LiveDVRController`'s `dvrStateChange` event) on the real media element. On set it reflects
   * the live/at-edge state onto the host and renders the formatted offset via the shared
   * `formatLiveOffset` helper (Req 1.6).
   */
  set dvrState(state: LiveIndicatorDVRState | null) {
    this.latestState = state;
    this.applyState(state);
  }

  /**
   * Pure-live flag (default `false`). A PURE live stream (live WITHOUT a DVR window) has no
   * `dvrState`/controller, yet the viewer is ALWAYS at the live edge — so the badge must show the
   * RED at-edge dot, not the grey behind-live dot. When set, the element reflects
   * `data-live`/`data-at-edge` as `true` regardless of `dvrState` (which is absent in pure live).
   * In live-DVR this stays `false` and the real `dvrState.isAtLiveEdge` drives the dot.
   */
  private _pureLive = false;

  set pureLive(value: boolean) {
    this._pureLive = Boolean(value);
    this.applyState(this.latestState);
  }

  get pureLive(): boolean {
    return this._pureLive;
  }

  /**
   * Re-resolves the "Live" label when the `language` attribute changes (parity with the other
   * i18n elements), repainting the label region immediately.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
      if (this.label !== null) {
        this.label.textContent = this.translations.live ?? 'Live';
      }
    }
  }

  /**
   * Builds the Markup_Contract: a `part="live-indicator"` container holding a `part="live-dot"`
   * status dot and a `part="live-offset"` text region. Nodes are created and APPENDED (never
   * via `innerHTML`) so the adopted Style_Layer survives. A guard keeps `render` idempotent
   * across reconnects, and the click handler is paired with a disposer for deterministic
   * cleanup. After (re)render the last known DVR state is re-applied so a reconnect restores
   * the visible offset/state.
   */
  protected render(): void {
    if (this.indicator !== null) {
      this.applyState(this.latestState);
      return;
    }

    const indicatorPart: LiveIndicatorPart = 'live-indicator';
    const indicator = document.createElement('div');
    indicator.setAttribute('part', indicatorPart);

    // Seed translations from any `language` attribute set before connect.
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    const dotPart: LiveIndicatorPart = 'live-dot';
    const dot = document.createElement('span');
    dot.setAttribute('part', dotPart);

    // "Live" text label (parity with the original badge). Localized via the `language` attribute.
    const labelPart: LiveIndicatorPart = 'live-label';
    const label = document.createElement('span');
    label.setAttribute('part', labelPart);
    label.textContent = this.translations.live ?? 'Live';

    // A click while behind live jumps to the live edge via a seek request (Req 2.1); at the
    // edge (or with no DVR) it is a no-op so the indicator stays inert when there is nothing
    // to catch up to.
    const onClick = (): void => this.seekToLive();
    indicator.addEventListener('click', onClick);
    this.addDisposer(() => indicator.removeEventListener('click', onClick));

    indicator.appendChild(dot);
    indicator.appendChild(label);

    this.indicator = indicator;
    this.label = label;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(indicator);

    // Restore any state fed before the element was connected/rendered.
    this.applyState(this.latestState);
  }

  /**
   * Reflects `data-live`/`data-at-edge` from the DVR state (Req 3.3). The negative live offset
   * is intentionally NOT rendered here: parity with the monolith, where the LIVE badge showed
   * only the dot + "Live" and the negative offset lived in the TIME read-out
   * (`playerstack-play-time`). Rendering it in both places duplicated the offset on screen.
   * A `null`/no-DVR state reflects not-live.
   */
  private applyState(state: LiveIndicatorDVRState | null): void {
    // Pure live (no DVR window): the viewer is always at the edge -> live + at-edge (red dot).
    if (this._pureLive) {
      this.reflectState({ live: true, atEdge: true });
      return;
    }
    if (state === null || !state.hasDVR) {
      this.reflectState({ live: null, atEdge: null });
      return;
    }

    this.reflectState({ live: true, atEdge: state.isAtLiveEdge });
  }

  /**
   * Emits a `playerstack-seek-request` targeting the current live edge (`seekableEnd`) when
   * behind live, so the `MediaController` can route the jump-to-live to the `PlayerAdapter`
   * (Req 2.1). No-op when at the edge or when DVR is unavailable.
   */
  private seekToLive(): void {
    const state = this.latestState;
    if (state === null || !state.hasDVR || state.isAtLiveEdge) {
      return;
    }
    this.dispatchRequest<SeekRequestDetail>('playerstack-seek-request', { time: state.seekableEnd });
  }
}
