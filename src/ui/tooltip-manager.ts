/**
 * `TooltipManager` — a controller-scoped, framework-agnostic recreation of the original
 * reactjs `Tooltip` component (Req parity). Instead of wrapping every control button in a
 * per-button tooltip (as the styled-components skin did), a SINGLE manager is attached to the
 * root `playerstack-media-controller`. It delegates hover over the control buttons and shows a
 * single floating label node, reproducing the original behaviour and its edge cases:
 *
 *   - Show the button's accessible name (`aria-label`) on hover; hide on mouse leave.
 *   - Horizontal CLAMPING within the player box: the label is nudged so it never overflows the
 *     controller's left/right edge (original clamped against `playerRef` with an 8px padding).
 *   - SUPPRESS while any menu is open: the original hid the tooltip when the player contained
 *     an `[aria-expanded='true']`; Core's settings/context-menu reflect `data-open` on their
 *     hosts, so the manager suppresses while a `[data-open]` (or `[aria-expanded='true']`)
 *     descendant exists.
 *   - SUPPRESS on click: clicking a control hides the tooltip until the pointer leaves and
 *     re-enters (original set `suppressed` on click, cleared on mouse leave).
 *   - Fullscreen sizing is handled by the Style_Layer (`[data-fullscreen]`), not here.
 *
 * The manager is pure DOM (no framework imports), so it keeps Core agnostic. It owns a single
 * floating `[part='tooltip-label']` node appended to the host and positions it absolutely over
 * the hovered button.
 */
import type { TooltipManagerParams, TooltipManagerPart } from '@typings/ui/tooltip-manager.types';

/** Padding (px) kept between the tooltip and the player edge when clamping (original `padding=8`). */
const CLAMP_PADDING = 8;

/** The floating label's `part` name (see the types file). */
const LABEL_PART: TooltipManagerPart = 'tooltip-label';

export class TooltipManager {
  /** Root player host: hover-delegation root + clamping bounding box. */
  private readonly host: HTMLElement;

  /** The single floating tooltip node, created lazily on the first hover. */
  private label: HTMLDivElement | null = null;

  /** The button currently hovered (whose label is shown), or `null` when hidden. */
  private currentTarget: HTMLElement | null = null;

  /** Set true after a click so the tooltip stays hidden until the pointer leaves + re-enters. */
  private suppressed = false;

  /** Pending rAF id for the clamp measurement (matches the original `requestAnimationFrame`). */
  private rafId: number | null = null;

  /** Bound listeners kept so they can be removed on destroy. */
  private readonly onPointerOver = (event: Event): void => this.handlePointerOver(event);
  private readonly onPointerOut = (event: Event): void => this.handlePointerOut(event);
  private readonly onClick = (): void => this.handleClick();

  constructor({ host }: TooltipManagerParams) {
    this.host = host;
    // Delegate at the host so any control button inside the light-DOM subtree is covered.
    this.host.addEventListener('pointerover', this.onPointerOver);
    this.host.addEventListener('pointerout', this.onPointerOut);
    this.host.addEventListener('click', this.onClick, true);
  }

  /**
   * Resolves the control BUTTON under the event target, if any. A control button is a
   * `<button>` carrying an `aria-label` (every Core control button sets one) that lives inside
   * the bottom control bar. Overlays/among others are excluded because they are not `<button>`
   * with a label in the bar. Returns `null` when the pointer is not over a control button.
   */
  private resolveButton(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const button = target.closest('button[aria-label]');
    if (button === null) {
      return null;
    }
    // Only buttons inside a control region get a tooltip (parity: the original wrapped the
    // bottom-bar controls). Valid regions: `.playerstack-controls` (video bar),
    // `[part='audio-controls']` (audio row), or a `playerstack-volume`/`playerstack-settings`
    // host (standalone controls placed directly in the controller for the audio skin).
    if (
      button.closest('.playerstack-controls') === null &&
      button.closest('[part="audio-controls"]') === null &&
      button.closest('playerstack-volume') === null &&
      button.closest('playerstack-settings') === null
    ) {
      return null;
    }
    return button as HTMLElement;
  }

  /**
   * Reports whether the tooltip must be suppressed because a menu is open. Mirrors the original
   * `playerElement.querySelectorAll('[aria-expanded="true"]').length > 0`, extended to Core's
   * `[data-open]` menu hosts (settings/context-menu) which express the same "a menu is open".
   */
  private isMenuOpen(): boolean {
    return this.host.querySelector('[aria-expanded="true"], [data-open]') !== null;
  }

  /** Lazily creates the floating label node and appends it to the host. */
  private ensureLabel(): HTMLDivElement {
    if (this.label === null) {
      const node = document.createElement('div');
      node.setAttribute('part', LABEL_PART);
      // Hidden until positioned; the Style_Layer animates opacity.
      node.setAttribute('data-visible', 'false');
      this.host.appendChild(node);
      this.label = node;
    }
    return this.label;
  }

  /**
   * Shows the tooltip for a hovered control button. No-ops when suppressed, when a menu is
   * open, or when the button has no non-empty label. Positions the label centered above the
   * button, then clamps it within the host box after paint (rAF), matching the original.
   */
  private handlePointerOver(event: Event): void {
    const button = this.resolveButton(event.target);
    if (button === null || button === this.currentTarget) {
      return;
    }

    const text = button.getAttribute('aria-label') ?? '';
    if (text === '' || this.suppressed || this.isMenuOpen()) {
      return;
    }

    this.currentTarget = button;
    const label = this.ensureLabel();
    label.textContent = text;
    // Reset any previous clamp offset before measuring the fresh position.
    label.style.removeProperty('left');
    label.setAttribute('data-visible', 'true');

    this.position(button, label);
  }

  /**
   * Hides the tooltip when the pointer leaves the current button (and does not immediately
   * enter it again). Clears the click-suppression so a fresh hover shows the tooltip again
   * (original cleared `suppressed` on mouse leave).
   */
  private handlePointerOut(event: Event): void {
    // Resolve the button the pointer is leaving. When suppressed-after-click the tooltip is
    // hidden and `currentTarget` is null, but leaving the button must STILL clear the
    // suppression so a fresh hover shows the tooltip again (original cleared it on mouse leave).
    const leaving = this.currentTarget ?? this.resolveButton(event.target);
    if (leaving === null) {
      return;
    }
    // Ignore pointerout that merely moves onto a child of the same button.
    const related = (event as PointerEvent).relatedTarget;
    if (related instanceof Node && leaving.contains(related)) {
      return;
    }
    this.hide();
    this.suppressed = false;
  }

  /** On any click inside the player, suppress the tooltip until the pointer leaves + re-enters. */
  private handleClick(): void {
    this.suppressed = true;
    this.hide();
  }

  /** Hides the floating label and clears the current target + any pending measurement. */
  private hide(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.currentTarget = null;
    if (this.label !== null) {
      this.label.setAttribute('data-visible', 'false');
    }
  }

  /**
   * Positions the label centered above the button, then CLAMPS it within the host box after
   * paint. The centering is done in CSS (`left:50%; transform:translateX(-50%)`); this only
   * measures overflow and applies a compensating `left` offset via inline style — mirroring the
   * original `offsetX` clamp (padding 8px) computed inside a `requestAnimationFrame`.
   */
  private position(button: HTMLElement, label: HTMLDivElement): void {
    // Anchor the label over the button. It is absolutely positioned within the host, so compute
    // the button's center X relative to the host and set it; the CSS transform re-centers it.
    const hostRect = this.host.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const centerX = buttonRect.left - hostRect.left + buttonRect.width / 2;
    label.style.left = `${centerX}px`;

    // A vertical volume slider opens its column UPWARD, directly above the mute button, so the
    // default above-the-button tooltip would sit ON TOP of that column and obscure it. When the
    // hovered button belongs to a `playerstack-volume[data-orientation='vertical']`, place the
    // tooltip to the RIGHT of the button instead (vertically centered on it), flagged via
    // `data-placement="right"` — this clears the upward-opening column AND stays inside the player
    // (a below-the-button tooltip would fall off the bottom edge in the bottom bar). Otherwise
    // keep the original above-button anchor.
    const isVerticalVolumeButton = button.closest("playerstack-volume[data-orientation='vertical']") !== null;
    if (isVerticalVolumeButton) {
      label.setAttribute('data-placement', 'right');
      label.style.removeProperty('bottom');
      // Anchor at the button's right edge, vertically centered on the button. The Style_Layer
      // offsets it right (margin-left) and re-centers vertically (translateY(-50%)); the default
      // horizontal `translateX(-50%)` is overridden there so it does not pull the label back over
      // the button.
      const left = buttonRect.right - hostRect.left;
      const top = buttonRect.top - hostRect.top + buttonRect.height / 2;
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
    } else {
      label.setAttribute('data-placement', 'top');
      label.style.removeProperty('top');
      const bottom = hostRect.bottom - buttonRect.top; // distance from host bottom to button top
      label.style.bottom = `${bottom}px`;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.currentTarget !== button || this.label === null) {
        return;
      }
      const freshHost = this.host.getBoundingClientRect();
      const labelRect = this.label.getBoundingClientRect();

      // Clamp horizontally within [host.left + pad, host.right - pad]; nudge `left` by the
      // overflow amount so the centered label shifts back inside the player box.
      let shift = 0;
      if (labelRect.left < freshHost.left + CLAMP_PADDING) {
        shift = freshHost.left + CLAMP_PADDING - labelRect.left;
      } else if (labelRect.right > freshHost.right - CLAMP_PADDING) {
        shift = freshHost.right - CLAMP_PADDING - labelRect.right;
      }
      if (shift !== 0) {
        this.label.style.left = `${centerX + shift}px`;
      }
    });
  }

  /** Removes listeners + the floating node and cancels any pending measurement (idempotent). */
  destroy(): void {
    this.host.removeEventListener('pointerover', this.onPointerOver);
    this.host.removeEventListener('pointerout', this.onPointerOut);
    this.host.removeEventListener('click', this.onClick, true);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.label !== null) {
      this.label.remove();
      this.label = null;
    }
    this.currentTarget = null;
  }
}
