/**
 * `playerstack-double-tap` — the double-tap-to-skip overlay with left (backward) and right
 * (forward) gesture zones and an accumulated skip indicator (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * Like the ad overlay, this element OWNS a headless `DoubleTapController` (Req 1.6). That
 * controller is framework-agnostic and needs no adapter — it only tracks tap counts, the
 * double-tap timing window, the accumulated skip seconds and the auto-hide timer — so it is
 * safe for the element to instantiate and drive it directly. This keeps the skip logic in the
 * shared Core controller rather than reimplemented in the element.
 *
 * Wiring:
 *   - Config: the public `config` setter recreates the controller with a `DoubleTapConfig`
 *     (skip seconds / double-tap delay / display duration) so consumers/adapters tune skipping
 *     the same way as the rest of Core.
 *   - Zones -> controller: a `click` on the left zone calls `controller.handleTapLeft()` and a
 *     `click` on the right zone calls `controller.handleTapRight()`. The controller itself
 *     implements the double-tap detection (a single tap emits `singleTap`; a second tap within
 *     the delay triggers a skip), so the element only forwards raw taps.
 *   - Controller -> seek request: `controller.setOnSeek(...)` dispatches a
 *     `playerstack-seek-request` with the computed target time so a skip rides the same
 *     Request/Response channel as every other seek (Req 2.1); it NEVER touches the media
 *     element directly.
 *   - Controller -> indicator: the element subscribes to `skip` to mirror the accumulated
 *     seconds into `part="skip-indicator"` and reflect `data-active`/`data-direction` on the
 *     host (Req 3.3); `singleTap` is observed for completeness (no visible side effect).
 *   - Store -> controller: `onStoreChange` forwards `seek`/`duration` via
 *     `controller.setTimeInfo(...)` so skip targets are computed against the live position
 *     (Req 1.6).
 *
 * Because it owns a controller with registered listeners plus a `destroy()`, it overrides
 * `disconnectedCallback` to tear the controller down before running the base cleanup.
 */
import type {
  DoubleTapPart,
  DoubleTapElementConfig,
  DoubleTapSkipState,
} from '@typings/ui/playerstack-double-tap.types';
import type { SeekRequestDetail } from '@typings/ui/media-controller.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { Translations } from '@i18n/index';
import { PlayerstackElement } from '@ui/playerstack-element';
import { DoubleTapController } from '@double-tap-controller';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { mobileSkipChevronIcon } from '@icons/mobile/index';
import { getTranslations } from '@i18n/index';

/** Default language applied when no `language` attribute is provided. */
const DEFAULT_LANGUAGE = 'en';

export class PlayerstackDoubleTap extends PlayerstackElement {
  /**
   * Declares `language` as an observed attribute so the skip indicator's "seconds" label is
   * localizable via markup (parity with the original SkipOverlay `{seconds} {i18n.seconds}`).
   */
  static override attributeSchema = {
    language: { attribute: 'language', type: 'string' },
  } as const;

  /**
   * The owned headless double-tap controller (Req 1.6). Instantiated eagerly since it is a
   * plain state machine with no adapter dependency; recreated by the `config` setter and torn
   * down in `disconnectedCallback`.
   */
  private controller = new DoubleTapController();

  /** The rendered skip indicator container (holds the chevron glyphs + the seconds text). */
  private skipIndicator: HTMLElement | null = null;

  /** The rendered seconds text region inside the indicator ("N seconds"). */
  private skipText: HTMLElement | null = null;

  /** Resolved translations for the "seconds" label; re-resolved on language change. */
  private translations: Translations = getTranslations(DEFAULT_LANGUAGE);

  /**
   * Reconfigures the owned controller with a new `DoubleTapConfig`. The controller has no
   * public reconfigure hook, so the element destroys the previous instance (clearing its
   * timers/listeners) and wires a fresh one with the new config, preserving the seek + skip
   * bindings.
   */
  set config(config: DoubleTapElementConfig | null) {
    this.controller.destroy();
    this.controller = new DoubleTapController(config ?? {});
    this.wireController();
  }

  /**
   * Builds the Markup_Contract: a `part="double-tap"` overlay holding a `part="double-tap-left"`
   * backward zone, a `part="double-tap-right"` forward zone and a `part="skip-indicator"`
   * readout. Nodes are created and APPENDED (never via `innerHTML`) so the adopted Style_Layer
   * survives. A guard keeps `render` idempotent across reconnects; each zone listener is paired
   * with a disposer for deterministic cleanup. Controller subscriptions are (re)wired here.
   */
  protected render(): void {
    if (this.skipIndicator !== null) {
      return;
    }

    const overlayPart: DoubleTapPart = 'double-tap';
    const overlay = document.createElement('div');
    overlay.setAttribute('part', overlayPart);

    // Left zone: a tap forwards to the controller, which detects the double-tap and skips
    // backward once the second tap lands within the delay.
    const leftPart: DoubleTapPart = 'double-tap-left';
    const left = document.createElement('div');
    left.setAttribute('part', leftPart);
    const onLeft = (): void => this.controller.handleTapLeft();
    left.addEventListener('click', onLeft);
    this.addDisposer(() => left.removeEventListener('click', onLeft));

    // Right zone: a tap forwards to the controller for a forward skip.
    const rightPart: DoubleTapPart = 'double-tap-right';
    const right = document.createElement('div');
    right.setAttribute('part', rightPart);
    const onRight = (): void => this.controller.handleTapRight();
    right.addEventListener('click', onRight);
    this.addDisposer(() => right.removeEventListener('click', onRight));

    // Seed translations from any `language` attribute set before connect.
    this.translations = getTranslations(this.getAttribute('language') ?? DEFAULT_LANGUAGE);

    const indicatorPart: DoubleTapPart = 'skip-indicator';
    const skipIndicator = document.createElement('div');
    skipIndicator.setAttribute('part', indicatorPart);

    // Three animated chevron glyphs (parity with the original SkipOverlay: three
    // `mobileSkipChevronIcon`s pointing in the skip direction), then the "N seconds" text.
    const icons = document.createElement('div');
    icons.setAttribute('part', 'skip-indicator-icons');
    for (let i = 0; i < 3; i++) {
      const chevron = document.createElement('span');
      chevron.className = 'icon icon-skip-chevron';
      chevron.innerHTML = renderSvgFromDescriptor(mobileSkipChevronIcon);
      icons.appendChild(chevron);
    }

    const skipText = document.createElement('span');
    skipText.setAttribute('part', 'skip-indicator-text');

    skipIndicator.appendChild(icons);
    skipIndicator.appendChild(skipText);

    overlay.appendChild(left);
    overlay.appendChild(right);
    overlay.appendChild(skipIndicator);

    this.skipIndicator = skipIndicator;
    this.skipText = skipText;

    this.wireController();

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(overlay);
  }

  /**
   * (Re)binds the owned controller's seek callback and event subscriptions and mirrors them
   * onto the overlay. The seek callback dispatches a `playerstack-seek-request` (Req 2.1); the
   * `skip` event updates the indicator text/state (Req 3.3) and `singleTap` is observed for
   * completeness. Each subscription is paired with an `off` disposer; the `destroy()` in
   * `disconnectedCallback` (and in the `config` setter) also drops them, keeping teardown
   * deterministic.
   */
  private wireController(): void {
    // A skip rides the shared seek request channel instead of touching the media element.
    this.controller.setOnSeek((time: number) => {
      this.dispatchRequest<SeekRequestDetail>('playerstack-seek-request', { time });
    });

    const onSkip = (state: DoubleTapSkipState): void => this.applySkipState(state);
    this.controller.on('skip', onSkip);
    this.addDisposer(() => this.controller.off('skip', onSkip));

    // Observed for completeness; a single tap has no visible skip-indicator side effect.
    const onSingleTap = (): void => {
      // Intentionally empty: single taps do not accumulate a skip.
    };
    this.controller.on('singleTap', onSingleTap);
    this.addDisposer(() => this.controller.off('singleTap', onSingleTap));
  }

  /**
   * Drives the controller from the shared store (Req 1.6): forwards the live position and
   * duration so skip targets are computed against the current time. Only the fields the
   * controller needs are read, per the base class's opt-in `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.controller.setTimeInfo(state.seek, state.duration);
  }

  /**
   * Mirrors the controller's `SkipState` onto the indicator: shows the accumulated seconds
   * while visible (clearing it on hide) and reflects `data-active`/`data-direction` on the
   * host so the Style_Layer can show/hide and orient the indicator (Req 3.3).
   */
  private applySkipState(state: DoubleTapSkipState): void {
    // Write ONLY the text region ("N seconds") so the chevron glyphs are preserved (setting
    // `textContent` on the whole indicator would wipe them). Parity with the original
    // `{seconds} {i18n.seconds}` readout; empty while hidden.
    if (this.skipText !== null) {
      const secondsLabel = this.translations.seconds ?? 'seconds';
      this.skipText.textContent = state.visible ? `${state.seconds} ${secondsLabel}` : '';
    }
    this.reflectState({
      active: state.visible ? true : null,
      direction: state.visible ? state.direction : null,
    });
  }

  /**
   * Re-resolves the "seconds" label when the `language` attribute changes (parity with the other
   * i18n elements); repaints the current text region if visible.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'language' && typeof value === 'string') {
      this.translations = getTranslations(value);
    }
  }

  /**
   * Tears down the owned controller (clearing its timers and listeners) before running the
   * base class's disposer cleanup, since this element owns a controller with subscriptions and
   * a lifecycle beyond the plain listener disposers.
   */
  override disconnectedCallback(): void {
    this.controller.destroy();
    super.disconnectedCallback();
  }
}
