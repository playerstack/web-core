/**
 * `playerstack-ad-overlay` — the ad overlay with skip-ad, progress and click-through (Req 1.4,
 * 1.6, 3.3, 5.1, 5.3).
 *
 * Unlike the request-only control elements, this overlay OWNS a headless `AdsController`
 * instance (Req 1.6). That controller is framework-agnostic and has no adapter dependency —
 * it only tracks pre-roll activation, the skip timer, ad progress and completion — so it is
 * safe for the element to instantiate and drive it directly. This keeps the ad logic in the
 * shared Core controller rather than reimplemented in the element.
 *
 * Wiring:
 *   - Config: the public `ads` setter forwards an `AdsConfig` (from `@typings/adapters.types`)
 *     to `controller.configure(...)`, so consumers/adapters attach `skipAfter`, `onSkip`,
 *     `onAdClick`, `onAdComplete` and `url` the same way the rest of Core does.
 *   - Store → controller: `onStoreChange` calls `controller.notifyPlay()` when playback first
 *     becomes true (guarded once) to trigger pre-roll activation, and forwards progress via
 *     `controller.update(seek, duration, isEnded)` so the skip timer and progress recompute
 *     (Req 1.6).
 *   - Controller → overlay: the element subscribes to the controller's `adActivated`,
 *     `adProgress`, `adSkippable`, `adCompleted` and `stateChange` events to show/hide the
 *     overlay, update the skip countdown and enable skip when `canSkip`, and paint progress.
 *     It reflects `data-active`/`data-skippable`/`data-can-skip` on the host (Req 3.3).
 *   - Interactions (Request/Response, Req 2.1): a skip click and a banner/click-region click ONLY
 *     dispatch `playerstack-ad-skip` / `playerstack-ad-click` request events. The element does NOT
 *     call `controller.onSkip()`/`controller.onAdClick()` (those merely re-invoke the consumer's
 *     `ads.onSkip`/`ads.onAdClick`, which the SKIN owns — the skin also pauses + opens the
 *     click-through URL). Invoking them here as well would fire the consumer callbacks twice. The
 *     controller keeps its config only for the state it drives (skip timer / completion) via
 *     `update()`.
 *
 * Because it owns a controller with registered listeners plus a `destroy()`, it overrides
 * `disconnectedCallback` to tear the controller down before running the base cleanup.
 *
 * Accessibility (Req 1.5): the rendered skip `<button>` carries the implicit ARIA `button`
 * role and its accessible name is configurable through the `aria-label` attribute; the default
 * English label applies when the consumer omits it.
 */
import type {
  AdOverlayAdsConfig,
  AdOverlayDefaultLabel,
  AdOverlayPart,
} from '@typings/ui/playerstack-ad-overlay.types';
import type { AdsState } from '@typings/ads-controller.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { AdsController } from '@ads-controller';
import { getTranslations } from '@i18n/index';

/** Default language used until the consumer sets one (parity with the other i18n elements). */
const DEFAULT_LANGUAGE = 'en';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: AdOverlayDefaultLabel = 'Skip ad';

export class PlayerstackAdOverlay extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the skip button's accessible name is
   * configurable via markup (Req 1.5). Keying the schema by `label` while mapping to the
   * `aria-label` attribute keeps the prop name readable and drives `observedAttributes`.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
    language: { attribute: 'language', type: 'string' },
  } as const;

  /**
   * The owned headless ads controller (Req 1.6). Instantiated eagerly since it is a plain
   * state machine with no adapter dependency; torn down in `disconnectedCallback`.
   */
  private readonly controller = new AdsController();

  /**
   * Guards the one-time `notifyPlay()` call: pre-roll activation must fire exactly once when
   * playback first becomes true, not on every subsequent `playing` store update.
   */
  private notifiedPlay = false;

  /** The rendered overlay container; kept so `render` stays idempotent across reconnects. */
  private overlay: HTMLElement | null = null;

  /** The rendered skip button; kept so its label/state can be updated after render. */
  private skipButton: HTMLButtonElement | null = null;

  /** Countdown text node inside the skip button (shows the remaining seconds before skippable). */
  private skipCountdown: HTMLElement | null = null;

  /**
   * Preview `<img>` inside the skip button showing the ORIGINAL video's poster next to the
   * countdown (parity with the original `StyledSkipPreviewImage`) — a peek at what resumes once
   * the ad is skipped. Only shown during the countdown when a poster URL is provided.
   */
  private skipPreview: HTMLImageElement | null = null;

  /** Original-video poster URL for the skip-countdown preview. `null`/empty hides the preview. */
  private _poster: string | null = null;

  /** Last known skippable state; the poster preview only shows during the countdown (`!canSkip`). */
  private _canSkip = false;

  /** Latest ad config; drives the banner (title/url/buttonText/icon). `null` = no ad. */
  private _ads: AdOverlayAdsConfig | null = null;

  /** Resolved translations for the banner's "Sponsored" label; re-resolved on language change. */
  private translations: Translations = getTranslations(DEFAULT_LANGUAGE);

  /** Rendered banner nodes, kept so `updateBanner` can repaint without rebuilding the DOM. */
  private bannerWrapper: HTMLElement | null = null;
  private bannerIcon: HTMLImageElement | null = null;
  private bannerTitle: HTMLElement | null = null;
  private bannerUrl: HTMLElement | null = null;
  private bannerButton: HTMLElement | null = null;
  private bannerSponsored: HTMLElement | null = null;

  /**
   * Configures the owned controller with an ad config (or `null` to deactivate). Public
   * property so consumers/adapters attach ads the same way as the rest of Core; delegates to
   * the controller, which resets its internal state on (re)configure. ALSO stores the config so
   * the ad BANNER (title / hostname / call-to-action button / icon) can be painted — parity with
   * the original AdsOverlay, which rendered that banner bottom-left during an ad.
   */
  set ads(config: AdOverlayAdsConfig | null) {
    this.notifiedPlay = false;
    this._ads = config;
    this.controller.configure(config);
    this.updateBanner();
  }

  get ads(): AdOverlayAdsConfig | null {
    return this._ads;
  }

  /**
   * Public property for the ORIGINAL video's poster URL, shown as a small preview next to the
   * skip countdown (parity with the original `StyledSkipPreviewImage`). Assigning it repaints the
   * skip affordance so the preview appears/updates immediately. `null`/empty hides the preview.
   */
  set poster(url: string | null) {
    this._poster = url && url.length > 0 ? url : null;
    this.applySkipPreview();
  }

  get poster(): string | null {
    return this._poster;
  }

  /**
   * Re-resolves the banner translations when the `language` attribute changes and repaints the
   * banner so the "Sponsored" label reflects the new language immediately (parity with the other
   * i18n elements, e.g. `playerstack-prevented-tip`).
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
      this.updateBanner();
    }
  }

  /**
   * Drives the controller from the shared store (Req 1.6): triggers pre-roll activation once
   * when playback first becomes true, then forwards progress so the skip timer and ad progress
   * recompute. Only the fields the controller needs are read, per the base class's opt-in
   * `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    if (state.playing && !this.notifiedPlay) {
      this.notifiedPlay = true;
      this.controller.notifyPlay();
    }
    this.controller.update(state.seek, state.duration, state.isEnded);
  }

  /**
   * Builds the Markup_Contract: a `part="ad-overlay"` container (hidden until an ad is active)
   * holding a `part="ad-skip-button"` skip affordance and a clickable `part="ad-click"` region.
   *
   * NO separate `part="ad-progress"` bar is rendered: the normal `playerstack-time-slider`
   * doubles as the ad progress bar in ad mode (tinted yellow via its `adMode`), matching the
   * ORIGINAL where the TimeSlider WAS the ad progress and there was NO second bar. The skin
   * bridges the ad currentTime/duration into the shared store during an ad, so the slider fill
   * tracks ad progress without this overlay painting its own timeline (avoids the DOUBLE bar).
   *
   * Nodes are created and APPENDED (never via `innerHTML`) so the adopted Style_Layer — in the
   * fallback path an injected `<style>` — is preserved. A guard keeps `render` idempotent across
   * reconnects. Controller subscriptions are wired here and paired with disposers for
   * deterministic cleanup.
   */
  protected render(): void {
    if (this.overlay !== null) {
      return;
    }

    // Seed translations from any `language` attribute set before connect.
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    const overlayPart: AdOverlayPart = 'ad-overlay';
    const overlay = document.createElement('div');
    overlay.setAttribute('part', overlayPart);
    // Hidden until an ad activates; `adActivated` flips it on and `adCompleted` off.
    overlay.style.display = 'none';

    // Click-through region: a click routes to the controller (invoking the configured
    // `onAdClick`) and also dispatches a request event for adapter extensibility.
    const clickPart: AdOverlayPart = 'ad-click';
    const clickRegion = document.createElement('div');
    clickRegion.setAttribute('part', clickPart);
    // Request/Response (Req 2.1, A6): the element only EXPRESSES the click intent via the request
    // event. It does NOT invoke `controller.onAdClick()` here — that just calls the consumer's
    // `ads.onAdClick`, which the SKIN owns (it also pauses + opens the click-through URL). Invoking
    // it here too would fire the consumer callback TWICE (element + skin). The controller keeps its
    // config only for the state it actually drives (skip timer / completion) via `update()`.
    const onAdClick = (): void => {
      this.dispatchRequest('playerstack-ad-click');
    };
    clickRegion.addEventListener('click', onAdClick);
    this.addDisposer(() => clickRegion.removeEventListener('click', onAdClick));

    // Skip affordance: a click routes to the controller (invoking the configured `onSkip`) and
    // also dispatches a request event for adapter extensibility.
    const skipPart: AdOverlayPart = 'ad-skip-button';
    const skipButton = document.createElement('button');
    skipButton.setAttribute('part', skipPart);
    skipButton.setAttribute('type', 'button');
    // The accessible name comes from the host's `aria-label` when set, else the default
    // (Req 1.5). `<button>` already carries the implicit ARIA `button` role.
    skipButton.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);
    // Disabled until the controller reports the ad is skippable.
    skipButton.disabled = true;
    // Same Request/Response rule as the click region: only emit the skip intent; the skin invokes
    // the consumer's `ads.onSkip`. Calling `controller.onSkip()` here would double-fire it.
    const onSkipClick = (): void => {
      this.dispatchRequest('playerstack-ad-skip');
    };
    skipButton.addEventListener('click', onSkipClick);
    this.addDisposer(() => skipButton.removeEventListener('click', onSkipClick));

    // Skip button content (parity with the original StyledSkipMessage / StyledSkipButton):
    //   - Countdown phase: a `[part='ad-skip-countdown']` number + a `[part='ad-skip-preview']`
    //     poster image of the ORIGINAL video (what resumes on skip).
    //   - Skippable phase: the plain "Skip ad" label (set as the button's text; the countdown +
    //     preview are hidden).
    const skipCountdownPart: AdOverlayPart = 'ad-skip-countdown';
    const skipCountdown = document.createElement('span');
    skipCountdown.setAttribute('part', skipCountdownPart);
    const skipPreviewPart: AdOverlayPart = 'ad-skip-preview';
    const skipPreview = document.createElement('img');
    skipPreview.setAttribute('part', skipPreviewPart);
    skipPreview.alt = '';
    skipPreview.draggable = false;
    skipPreview.style.display = 'none';
    skipButton.appendChild(skipCountdown);
    skipButton.appendChild(skipPreview);

    // Ad BANNER (parity with the original AdsOverlay bottom-left gadget): a clickable card with
    // an optional icon, the ad title + click-through hostname, and a call-to-action button, plus
    // a "Sponsored · host" label beneath it. Click routes through the same ad-click handler as
    // the click region. Nodes are created here and repainted by `updateBanner`; hidden until an
    // ad config is present.
    const bannerWrapper = document.createElement('div');
    bannerWrapper.setAttribute('part', 'ad-banner-wrapper' satisfies AdOverlayPart);

    const banner = document.createElement('div');
    banner.setAttribute('part', 'ad-banner' satisfies AdOverlayPart);
    banner.setAttribute('role', 'link');
    // Banner card + its CTA button ("Visit site") share the click-through intent: only emit the
    // request (the button is a child, so its click bubbles here). The skin invokes the consumer
    // callback + opens the URL; do NOT call `controller.onAdClick()` (would double-fire).
    const onBannerClick = (): void => {
      this.dispatchRequest('playerstack-ad-click');
    };
    banner.addEventListener('click', onBannerClick);
    this.addDisposer(() => banner.removeEventListener('click', onBannerClick));

    const bannerIcon = document.createElement('img');
    bannerIcon.setAttribute('part', 'ad-icon' satisfies AdOverlayPart);
    bannerIcon.alt = '';
    bannerIcon.style.display = 'none';

    const bannerInfo = document.createElement('div');
    bannerInfo.setAttribute('part', 'ad-info' satisfies AdOverlayPart);
    const bannerTitle = document.createElement('span');
    bannerTitle.setAttribute('part', 'ad-title' satisfies AdOverlayPart);
    const bannerUrl = document.createElement('span');
    bannerUrl.setAttribute('part', 'ad-url' satisfies AdOverlayPart);
    bannerInfo.appendChild(bannerTitle);
    bannerInfo.appendChild(bannerUrl);

    const bannerButton = document.createElement('button');
    bannerButton.setAttribute('part', 'ad-button' satisfies AdOverlayPart);
    bannerButton.setAttribute('type', 'button');

    banner.appendChild(bannerIcon);
    banner.appendChild(bannerInfo);
    banner.appendChild(bannerButton);

    const bannerSponsored = document.createElement('span');
    bannerSponsored.setAttribute('part', 'ad-sponsored' satisfies AdOverlayPart);

    bannerWrapper.appendChild(banner);
    bannerWrapper.appendChild(bannerSponsored);

    overlay.appendChild(bannerWrapper);
    overlay.appendChild(clickRegion);
    overlay.appendChild(skipButton);

    this.overlay = overlay;
    this.skipButton = skipButton;
    this.skipCountdown = skipCountdown;
    this.skipPreview = skipPreview;
    this.bannerWrapper = bannerWrapper;
    this.bannerIcon = bannerIcon;
    this.bannerTitle = bannerTitle;
    this.bannerUrl = bannerUrl;
    this.bannerButton = bannerButton;
    this.bannerSponsored = bannerSponsored;
    this.updateBanner();

    this.wireController();

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(overlay);
  }

  /**
   * Subscribes to the owned controller's events and mirrors them onto the overlay. Each
   * handler is paired with an `off` disposer so the subscriptions are cleaned up on disconnect
   * (the `destroy()` in `disconnectedCallback` also drops them; both paths keep teardown
   * deterministic).
   */
  private wireController(): void {
    const onActivated = (): void => {
      if (this.overlay !== null) {
        this.overlay.style.display = '';
      }
      this.reflectState({ active: true });
    };
    this.controller.on('adActivated', onActivated);
    this.addDisposer(() => this.controller.off('adActivated', onActivated));

    const onProgress = (data: { progress: number; canSkip: boolean; skipCountdown: number }): void => {
      // Ad PROGRESS is surfaced by the shared time-slider (tinted yellow in ad mode), NOT by a
      // separate bar in this overlay, so only the skip countdown/enabled state is updated here.
      this.updateSkip(data.canSkip, data.skipCountdown);
    };
    this.controller.on('adProgress', onProgress);
    this.addDisposer(() => this.controller.off('adProgress', onProgress));

    const onSkippable = (): void => {
      this.reflectState({ skippable: true });
    };
    this.controller.on('adSkippable', onSkippable);
    this.addDisposer(() => this.controller.off('adSkippable', onSkippable));

    const onStateChange = (state: AdsState): void => {
      // Reflect with camelCase keys so the base class's pure reflector maps `canSkip` ->
      // `data-can-skip` per its documented camelCase<->kebab contract (Req 3.3).
      this.reflectState({ active: state.isAdActive, skippable: state.hasSkipTimer, canSkip: state.canSkip });
      this.updateSkip(state.canSkip, state.skipCountdown);
    };
    this.controller.on('stateChange', onStateChange);
    this.addDisposer(() => this.controller.off('stateChange', onStateChange));

    const onCompleted = (): void => {
      if (this.overlay !== null) {
        this.overlay.style.display = 'none';
      }
      this.reflectState({ active: null, skippable: null, canSkip: null });
    };
    this.controller.on('adCompleted', onCompleted);
    this.addDisposer(() => this.controller.off('adCompleted', onCompleted));
  }

  /**
   * Enables/disables the skip button and updates its countdown text from the controller's
   * `canSkip`/`skipCountdown`, and reflects `data-can-skip` on the host (Req 3.3). Before the
   * ad is skippable the button shows the remaining seconds; once skippable it shows the label.
   */
  private updateSkip(canSkip: boolean, skipCountdown: number): void {
    if (this.skipButton === null || this.skipCountdown === null) {
      return;
    }
    this._canSkip = canSkip;
    this.skipButton.disabled = !canSkip;
    // Parity with the original AdsOverlay: BEFORE the ad is skippable the affordance shows ONLY
    // the remaining seconds (`StyledSkipCountdownText`) plus the original-video poster preview
    // (`StyledSkipPreviewImage`); ONCE skippable it shows the "Skip ad" label alone. It never
    // reads "Skip ad (N)".
    // The text node carries EITHER the "Skip ad" label (skippable) OR the countdown number.
    this.skipCountdown.textContent = canSkip ? DEFAULT_LABEL : String(skipCountdown);
    this.skipCountdown.style.display = '';
    // The poster preview shows only during the countdown (toggled by applySkipPreview).
    this.applySkipPreview();
    // camelCase key so the pure reflector maps `canSkip` -> `data-can-skip` (Req 3.3).
    this.reflectState({ canSkip });
  }

  /**
   * Shows the original-video poster preview `<img>` next to the countdown ONLY during the
   * countdown (`!canSkip`) and only when a poster URL is set; hides it once skippable or when no
   * poster is provided (parity with the original `{poster && <StyledSkipPreviewImage/>}` inside
   * the countdown branch). Safe to call from either the poster setter or `updateSkip`.
   */
  private applySkipPreview(): void {
    if (this.skipPreview === null) {
      return;
    }
    const show = !this._canSkip && this._poster !== null;
    if (show && this._poster !== null) {
      if (this.skipPreview.getAttribute('src') !== this._poster) {
        this.skipPreview.setAttribute('src', this._poster);
      }
      this.skipPreview.style.display = '';
    } else {
      this.skipPreview.style.display = 'none';
    }
  }

  /**
   * Paints the ad banner from the current `_ads` config (parity with the original AdsOverlay):
   * the title, the click-through hostname (derived from `url`), the call-to-action button label
   * and the optional icon, plus the "Sponsored · host" label. When there is no config (or no
   * title) the banner is hidden so a bare skip affordance still works. Safe to call before the
   * DOM exists (guards on the refs) and re-runnable without rebuilding nodes.
   */
  private updateBanner(): void {
    if (this.bannerWrapper === null) {
      return;
    }
    const config = this._ads;
    // Show the banner only when the ad provides a TITLE (parity with the original, whose banner
    // was the advertiser name). A url-only config would otherwise render an empty title span next
    // to the hostname, so gate on `title` presence and hide the banner when it is absent.
    if (config === null || config.title === undefined || config.title === '') {
      this.bannerWrapper.style.display = 'none';
      return;
    }
    this.bannerWrapper.style.display = '';

    // Derive the display hostname from the click-through URL (fallback to the raw string).
    let host = config.url ?? '';
    if (config.url !== undefined) {
      try {
        host = new URL(config.url).hostname;
      } catch {
        host = config.url;
      }
    }

    if (this.bannerTitle !== null) {
      this.bannerTitle.textContent = config.title ?? '';
    }
    if (this.bannerUrl !== null) {
      this.bannerUrl.textContent = host;
    }
    if (this.bannerButton !== null) {
      this.bannerButton.textContent = config.buttonText ?? '';
      this.bannerButton.style.display = config.buttonText ? '' : 'none';
    }
    if (this.bannerIcon !== null) {
      if (config.icon !== undefined && config.icon !== '') {
        this.bannerIcon.src = config.icon;
        this.bannerIcon.style.display = '';
      } else {
        this.bannerIcon.removeAttribute('src');
        this.bannerIcon.style.display = 'none';
      }
    }
    if (this.bannerSponsored !== null) {
      const sponsored = this.translations.sponsored ?? 'Sponsored';
      // "Sponsored · host" (parity with the original `{sponsored} • {host}`).
      this.bannerSponsored.textContent = host ? `${sponsored} \u2022 ${host}` : sponsored;
    }
  }

  /**
   * Tears down the owned controller (removing its listeners) before running the base class's
   * disposer cleanup, since this element owns a controller with subscriptions and a lifecycle
   * beyond the plain listener disposers.
   */
  override disconnectedCallback(): void {
    this.controller.destroy();
    super.disconnectedCallback();
  }
}
