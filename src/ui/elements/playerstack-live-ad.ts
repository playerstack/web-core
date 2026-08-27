/**
 * `playerstack-live-ad` — the Twitch-style live-stream ad break overlay (Req 1.4, 1.6, 3.3, 5.1,
 * 5.3).
 *
 * This is REUSABLE UI, so its markup lives in Core as a Custom Element (not in a skin). It OWNS a
 * headless `LiveAdController` (the phase machine: idle→playing→exiting, skip timing, exit timer)
 * and renders the overlay markup + the ad `<video>` it controls. The stream-side I/O — muting /
 * restoring / suppressing native pause on the REAL live `<video>`, plus opening the CTA URL —
 * is supplied by an injected `LiveAdAdapter`; the element wraps that adapter to add its OWN
 * ad-video `releaseAd`, so the controller drives everything through one adapter while Core never
 * reaches for the sibling stream element itself.
 *
 * Wiring (mirrors `playerstack-ad-overlay`):
 *   - `adapter` (property): the stream `LiveAdAdapter` from the skin.
 *   - `triggerAd(config)` (method) / `trigger` (property): starts a break via the controller.
 *   - The element renders the ad `<video>` and wires its `timeupdate`/`ended` to
 *     `controller.updateProgress`/`adEnded`; the skip button → `controller.skipAd()`, the CTA →
 *     `controller.clickAd()`.
 *   - Controller → overlay: subscribes to `stateChange` to show/hide, set the ad `<video>` src,
 *     paint the skip label/countdown, the progress `scaleX`, and reflect `data-active`/
 *     `data-exiting` on the host.
 *   - `language` (attribute): localizes the AD / Live Stream / Skip labels.
 *
 * Because it owns a controller with a lifecycle, it overrides `disconnectedCallback` to tear the
 * controller down before the base cleanup.
 */
import type { LiveAdAdapter } from '@typings/adapters.types';
import type { LiveAdConfig, LiveAdState } from '@typings/live-ad-controller.types';
import type { LiveAdPart } from '@typings/ui/playerstack-live-ad.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { LiveAdController } from '@live-ad-controller';
import { getTranslations } from '@i18n/index';

const DEFAULT_LANGUAGE = 'en';

export class PlayerstackLiveAd extends PlayerstackElement {
  /** Localizes the AD / Live Stream / Skip labels via the `language` attribute. */
  static override attributeSchema = {
    language: { attribute: 'language', type: 'string' },
  } as const;

  /** The owned headless live-ad phase machine. Built lazily once an adapter is provided. */
  private controller: LiveAdController | null = null;

  /** Stream-side I/O from the skin (mute/restore/suppress-pause/openUrl). */
  private _adapter: LiveAdAdapter | null = null;

  /**
   * A break requested via `trigger`/`triggerAd` BEFORE the controller existed (the adapter had
   * not been injected yet — e.g. the skin resolves the `<video>` async, so the trigger prop can
   * arrive before the adapter prop). Retained so the break fires as soon as the controller is
   * built, instead of being silently dropped. Cleared once consumed.
   */
  private _pendingTrigger: LiveAdConfig | null = null;

  /** Resolved translations; re-resolved on `language` change. */
  private translations: Translations = getTranslations(DEFAULT_LANGUAGE);

  /** Rendered nodes, kept for idempotent render + repaint. */
  private overlay: HTMLElement | null = null;
  private adVideo: HTMLVideoElement | null = null;
  private badge: HTMLElement | null = null;
  private info: HTMLElement | null = null;
  private streamBadge: HTMLElement | null = null;
  private cta: HTMLButtonElement | null = null;
  private skip: HTMLButtonElement | null = null;
  private progressBar: HTMLElement | null = null;

  // ─── Public inputs ────────────────────────────────────────

  /** Injected stream `LiveAdAdapter`. Building it (re)creates the controller. */
  set adapter(value: LiveAdAdapter | null) {
    this._adapter = value;
    this.rebuildController();
  }

  get adapter(): LiveAdAdapter | null {
    return this._adapter;
  }

  /** Property channel to trigger a break (equivalent to calling `triggerAd`). `null` = no-op. */
  set trigger(config: LiveAdConfig | null) {
    if (config) this.triggerAd(config);
  }

  /**
   * Imperative API to start a live ad break. If the controller does not exist yet (no adapter
   * injected / not rendered), the config is stashed as `_pendingTrigger` and fired the moment the
   * controller is built (`rebuildController`), so a trigger that arrives before the adapter is not
   * lost.
   */
  triggerAd(config: LiveAdConfig): void {
    if (this.controller) {
      this.controller.triggerAd(config);
    } else {
      this._pendingTrigger = config;
    }
  }

  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
      this.paint(this.controller?.state);
    }
  }

  // ─── Rendering ────────────────────────────────────────────

  /**
   * Builds the Markup_Contract (parity with the original LiveAdOverlay): a `part="live-ad"`
   * container holding the ad `<video>`, a top bar (badge + title), and a bottom bar (Live Stream
   * pill + CTA + Skip) over a progress bar. Hidden until an ad is active. Nodes are APPENDED so
   * the adopted Style_Layer survives; a guard keeps `render` idempotent.
   */
  protected render(): void {
    if (this.overlay !== null) {
      return;
    }
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    const p = (name: LiveAdPart, el: HTMLElement): HTMLElement => {
      el.setAttribute('part', name);
      return el;
    };

    const overlay = p('live-ad', document.createElement('div'));
    overlay.style.display = 'none';

    const adVideo = p('live-ad-video', document.createElement('video')) as HTMLVideoElement;
    adVideo.autoplay = true;
    adVideo.playsInline = true;
    adVideo.setAttribute('playsinline', '');
    const onTimeUpdate = (): void => {
      this.controller?.updateProgress(adVideo.currentTime, adVideo.duration || 0);
    };
    const onEnded = (): void => this.controller?.adEnded();
    adVideo.addEventListener('timeupdate', onTimeUpdate);
    adVideo.addEventListener('ended', onEnded);
    this.addDisposer(() => {
      adVideo.removeEventListener('timeupdate', onTimeUpdate);
      adVideo.removeEventListener('ended', onEnded);
    });

    const topBar = p('live-ad-top-bar', document.createElement('div'));
    const badge = p('live-ad-badge', document.createElement('span'));
    const info = p('live-ad-info', document.createElement('span'));
    topBar.appendChild(badge);
    topBar.appendChild(info);

    const bottomBar = p('live-ad-bottom-bar', document.createElement('div'));
    const actions = p('live-ad-actions', document.createElement('div'));
    const streamBadge = p('live-ad-stream-badge', document.createElement('span'));

    const cta = p('live-ad-cta', document.createElement('button')) as HTMLButtonElement;
    cta.type = 'button';
    const onCta = (): void => this.controller?.clickAd();
    cta.addEventListener('click', onCta);
    this.addDisposer(() => cta.removeEventListener('click', onCta));

    const skip = p('live-ad-skip', document.createElement('button')) as HTMLButtonElement;
    skip.type = 'button';
    const onSkip = (): void => this.controller?.skipAd();
    skip.addEventListener('click', onSkip);
    this.addDisposer(() => skip.removeEventListener('click', onSkip));

    actions.appendChild(streamBadge);
    actions.appendChild(cta);
    actions.appendChild(skip);

    const progress = p('live-ad-progress', document.createElement('div'));
    const progressBar = p('live-ad-progress-bar', document.createElement('div'));
    progress.appendChild(progressBar);

    bottomBar.appendChild(actions);
    bottomBar.appendChild(progress);

    overlay.appendChild(adVideo);
    overlay.appendChild(topBar);
    overlay.appendChild(bottomBar);

    this.overlay = overlay;
    this.adVideo = adVideo;
    this.badge = badge;
    this.info = info;
    this.streamBadge = streamBadge;
    this.cta = cta;
    this.skip = skip;
    this.progressBar = progressBar;

    this.root.appendChild(overlay);
    this.rebuildController();
    this.paint(this.controller?.state);
  }

  // ─── Controller wiring ────────────────────────────────────

  /**
   * (Re)creates the owned controller for the current adapter. The controller receives a WRAPPED
   * adapter: stream ops delegate to the injected `LiveAdAdapter`, while `releaseAd` acts on this
   * element's OWN ad `<video>`. Subscribes to `stateChange` to paint.
   */
  private rebuildController(): void {
    if (this.controller !== null) {
      this.controller.destroy();
      this.controller = null;
    }
    const stream = this._adapter;
    if (!stream) {
      return;
    }
    const wrapped: LiveAdAdapter = {
      muteStream: () => stream.muteStream(),
      restoreStream: (wasMuted) => stream.restoreStream(wasMuted),
      suppressStreamPause: () => stream.suppressStreamPause(),
      openUrl: (url) => stream.openUrl(url),
      // The ad `<video>` is owned by THIS element, so releasing it is element-internal.
      releaseAd: () => {
        const el = this.adVideo;
        if (el) {
          el.pause();
          el.removeAttribute('src');
          // `load()` resets the media element after clearing the src; guarded because some
          // environments (jsdom in tests) don't implement it.
          try {
            el.load();
          } catch {
            /* not implemented in this environment */
          }
        }
        stream.releaseAd();
      },
    };
    const controller = new LiveAdController(wrapped);
    controller.on('stateChange', (state) => this.paint(state));
    this.controller = controller;
    // Fire any break requested before the controller existed (trigger arrived before adapter).
    if (this._pendingTrigger) {
      const pending = this._pendingTrigger;
      this._pendingTrigger = null;
      controller.triggerAd(pending);
    }
  }

  /**
   * Start the ad `<video>`. Tries to play with sound first; if the browser's autoplay policy
   * rejects it (no user gesture), retries muted so a programmatically-triggered ad break still
   * plays. The live stream is already muted behind the ad, so a muted ad start is acceptable.
   * `play()` may return `undefined` in some environments (older browsers / jsdom) — guarded.
   */
  private startAdPlayback(): void {
    const el = this.adVideo;
    if (!el) return;
    const attempt = el.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        // Autoplay-with-sound blocked: fall back to a muted start (never leaves the ad paused).
        el.muted = true;
        const retry = el.play();
        if (retry && typeof retry.catch === 'function') {
          retry.catch(() => {
            /* Even muted playback can be interrupted (e.g. immediate unmount); ignore. */
          });
        }
      });
    }
  }

  // ─── Paint ────────────────────────────────────────────────

  /** Reflects the controller state onto the overlay markup (parity with the original render). */
  private paint(state: LiveAdState | undefined): void {
    if (this.overlay === null || this.adVideo === null) {
      return;
    }
    if (!state || !state.isActive) {
      this.overlay.style.display = 'none';
      this.overlay.removeAttribute('data-exiting');
      this.reflectState({ active: null });
      return;
    }

    this.overlay.style.display = '';
    this.reflectState({ active: true });
    if (state.isExiting) {
      this.overlay.setAttribute('data-exiting', 'true');
    } else {
      this.overlay.removeAttribute('data-exiting');
    }

    // Set the ad source once (avoid resetting playback each paint) and kick off playback. The ad
    // `<video>` has `autoplay`, but browsers block autoplay-with-sound without a user gesture, so
    // a break triggered programmatically (timer/API) would sit paused. Explicitly `play()` and, if
    // the autoplay policy rejects it, retry muted so the ad ALWAYS starts — the stream is already
    // muted behind it, so a muted ad start is the correct, gesture-free fallback.
    if (state.url && this.adVideo.getAttribute('src') !== state.url) {
      this.adVideo.setAttribute('src', state.url);
      this.startAdPlayback();
    }

    if (this.badge !== null) this.badge.textContent = this.translations.liveAdBadge ?? 'AD';
    if (this.info !== null) {
      this.info.textContent = state.title ?? '';
      this.info.style.display = state.title ? '' : 'none';
    }
    if (this.streamBadge !== null) this.streamBadge.textContent = this.translations.liveStreamBadge ?? 'Live Stream';

    if (this.cta !== null) {
      this.cta.textContent = state.buttonText ?? '';
      this.cta.style.display = state.buttonText ? '' : 'none';
    }

    if (this.skip !== null) {
      const canSkip = state.canSkip;
      this.skip.setAttribute('data-can-skip', canSkip ? 'true' : 'false');
      if (canSkip) {
        this.skip.textContent = this.translations.liveAdSkip ?? 'Skip Ad';
      } else {
        const template = this.translations.liveAdSkipIn ?? 'Skip in {seconds}s';
        this.skip.textContent = template.replace('{seconds}', String(state.skipCountdown));
      }
    }

    if (this.progressBar !== null) {
      const progress = state.duration > 0 ? state.currentTime / state.duration : 0;
      this.progressBar.style.transform = `scaleX(${progress})`;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────

  override disconnectedCallback(): void {
    if (this.controller !== null) {
      this.controller.destroy();
      this.controller = null;
    }
    super.disconnectedCallback();
  }
}
