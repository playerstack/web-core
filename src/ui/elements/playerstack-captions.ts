/**
 * `playerstack-captions` — the caption overlay that renders the active cue text with the
 * user-configurable caption style and is draggable/repositionable (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it primarily reflects state: it consumes the shared store to paint the
 * active cue text and never touches the media element. It additionally exposes a
 * `selectCaption(value)` method that dispatches a `playerstack-caption-request` event so an
 * external caption-track selection flows through the Request/Response model (Req 2.1, 21.1).
 *
 * PARITY with the original `CaptionOverlay`:
 *   - The caption source is a raw VTT string (parsed here) or an already-parsed cue array.
 *   - A configurable `captionStyle` (`CaptionStyleOptions`) drives the font family/size/color/
 *     opacity, the text background, a separate "window" box (windowColor/windowOpacity) and the
 *     character edge style — computed with the SAME shared helpers (`hexToRgba`,
 *     `getEdgeStyleCSS`) the rest of Core uses (Req 1.6). Fullscreen scales the base font 16→24px.
 *   - The overlay is DRAGGABLE: pressing and dragging repositions the box (percent-based), with
 *     clamps that keep it on screen (never over the top gear bar or the bottom timeline) and out
 *     of the center play-button zone while controls are visible; it auto-rests at the default Y
 *     and "snaps back" to auto-positioning when dropped near the resting line.
 *   - The box AUTO-POSITIONS with the control bar: while the user has not dragged, it rests a fixed
 *     distance ABOVE the control bar when the controls are visible and drops close to the bottom
 *     (with margin) when they hide, animating via the CSS `bottom` transition. Positioning uses a
 *     px offset from the bottom (not a fixed `top` %) so the margins stay consistent across player
 *     sizes. It observes the controller host's `data-hiding` to know the controls' visibility.
 *     Once dragged it keeps the user's position, only clamped so it never sits under the control
 *     bar (parity with the original `CaptionOverlay` effect).
 *
 * On every store change it recomputes the active cues from the tracked cues + `state.seek` using
 * the shared `getActiveCues` helper (Req 1.6), rebuilds the cue text spans, and reflects
 * `data-active` on the host so the Style_Layer can show/hide the overlay.
 */
import type { CaptionsSource, CaptionRequestDetail } from '@typings/ui/playerstack-captions.types';
import type { VTTCue, CaptionStyleOptions } from '@typings/utils/captions.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { parseVTTCaptions, getActiveCues, hexToRgba, getEdgeStyleCSS, DEFAULT_CAPTION_STYLE } from '@utils/captions';

/**
 * Resting distance from the player BOTTOM (in px), used for auto-positioning. Positioning by a
 * bottom offset (rather than a fixed `top` percentage) keeps the margins consistent regardless of
 * the player height — a fixed percentage left too big a gap to the control bar on shorter players
 * and clipped off-screen on taller ones. When the controls are VISIBLE the caption rests just
 * above the control bar (bar ≈ 44px + a small margin); when HIDDEN it drops near the bottom with a
 * decent margin. Fullscreen has a taller bar, so the visible offset grows to clear it.
 */
const REST_BOTTOM_CONTROLS = 56;
const REST_BOTTOM_CONTROLS_FS = 76;
const REST_BOTTOM_HIDDEN = 24;
/** Top safety margin (px) so the box never rides under the top gear bar. */
const MIN_TOP = 48;
/** Center play-button zone (percent of stage) the box avoids while controls are visible. */
const CENTER_ZONE = { xMin: 40, xMax: 60, yMin: 42, yMax: 58 };

export class PlayerstackCaptions extends PlayerstackElement {
  /** Parsed cues tracked from the assigned caption source. */
  private cues: VTTCue[] = [];

  /** Latest seek position (seconds) mirrored from the store; selects the active cues. */
  private seek = 0;

  /** Latest fullscreen flag mirrored from the store; scales the base font size (16→24). */
  private isFullscreen = false;

  /**
   * The user-configurable caption style; defaults to the shared `DEFAULT_CAPTION_STYLE`. Named
   * `captionStyleState` (NOT `style`) so it never shadows `HTMLElement.style`.
   */
  private captionStyleState: CaptionStyleOptions = { ...DEFAULT_CAPTION_STYLE };

  /** The rendered overlay container (the draggable box). */
  private container: HTMLElement | null = null;

  /** The rendered "window" box (windowColor/windowOpacity layer) holding the cue spans. */
  private windowEl: HTMLElement | null = null;

  /** Current box X position in PERCENT of the stage (centered via translateX(-50%)). */
  private posX = 50;
  /** Current box distance from the player BOTTOM in px (drives `bottom`). */
  private posBottom = REST_BOTTOM_CONTROLS;

  /** Drag bookkeeping. */
  private dragging = false;
  private userDragged = false;
  private dragDisposers: Array<() => void> = [];

  /** The controller host used as the positioning stage + the source of the controls-hiding state. */
  private stage: HTMLElement | null = null;

  /**
   * Whether the controls are currently HIDDEN (mirrors the controller host's `data-hiding`).
   * Drives the resting Y: controls visible -> 74%, hidden -> 88% (parity with the original
   * `areControlsVisible` -> DEFAULT_Y_CONTROLS_VISIBLE / DEFAULT_Y_CONTROLS_HIDDEN).
   */
  private controlsHidden = false;

  /** Observer on the controller host so a `data-hiding` toggle re-positions the captions. */
  private hidingObserver: MutationObserver | null = null;

  /**
   * Public setter/property to supply the caption source (VTT string parsed here, or a parsed
   * cue array handed straight in). Repaints the active cue immediately.
   */
  set captionsSrc(source: CaptionsSource | null) {
    if (source === null) {
      this.cues = [];
    } else if (typeof source === 'string') {
      this.cues = parseVTTCaptions(source);
    } else {
      this.cues = source;
    }
    this.updateActiveCue();
  }

  get captionsSrc(): CaptionsSource | null {
    return this.cues;
  }

  /**
   * Public setter for the caption style (`CaptionStyleOptions`). Merged over the defaults so a
   * partial style is safe; re-applies the computed styles to the current cues immediately.
   */
  set captionStyle(value: Partial<CaptionStyleOptions> | null) {
    this.captionStyleState = { ...DEFAULT_CAPTION_STYLE, ...(value ?? {}) };
    this.applyStyle();
  }

  get captionStyle(): CaptionStyleOptions {
    return this.captionStyleState;
  }

  /** Emits a `playerstack-caption-request` for an external track selection (Req 2.1, 21.1). */
  selectCaption(value: string): void {
    this.dispatchRequest<CaptionRequestDetail>('playerstack-caption-request', { value });
  }

  /**
   * Tracks the seek + fullscreen fields the overlay cares about and repaints. Fullscreen scales
   * the base font size, so a change repaints; the resting Y also shifts with the controls, but
   * that is driven by the host's `data-hiding` via the auto-position logic, not the store.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    const fsChanged = state.isFullScreen !== this.isFullscreen;
    this.seek = state.seek;
    this.isFullscreen = state.isFullScreen;
    this.updateActiveCue();
    if (fsChanged) {
      this.applyStyle();
      // Fullscreen changes the control-bar height, so the resting offset above it changes too
      // (56 -> 76). Re-rest (or re-clamp a dragged box) so the caption keeps its margin.
      this.syncPositionToControls();
    }
  }

  /**
   * Recomputes the active cues and rebuilds the cue spans (one `part="cue"` span per active cue,
   * matching the original per-cue text spans so multi-line/multi-cue text is not squashed).
   * Reflects `data-active` when a cue is showing.
   */
  private updateActiveCue(): void {
    if (this.windowEl === null) {
      return;
    }
    const activeCues = getActiveCues(this.cues, this.seek);
    // Rebuild the cue spans (clear then append) so each cue is its own styled line.
    this.windowEl.textContent = '';
    for (const cue of activeCues) {
      const span = document.createElement('span');
      span.setAttribute('part', 'cue');
      // pre-wrap preserves in-cue line breaks without distorting the box.
      span.style.whiteSpace = 'pre-wrap';
      span.textContent = cue.text;
      this.windowEl.appendChild(span);
    }
    this.reflectState({ active: activeCues.length > 0 });
    this.applyStyle();
  }

  /**
   * Applies the computed caption style to the window box + cue spans (parity with the original
   * CaptionOverlay): base font 16px (24 fullscreen) scaled by `fontSize`%, text color/opacity,
   * per-span background color/opacity, the window box color/opacity, and the edge text-shadow.
   * `small-caps` maps to `font-variant` rather than a family.
   */
  private applyStyle(): void {
    if (this.windowEl === null) {
      return;
    }
    const s = this.captionStyleState;
    const base = this.isFullscreen ? 24 : 16;
    const fontScale = (parseInt(s.fontSize, 10) || 100) / 100;
    const textColor = hexToRgba(s.fontColor, s.fontOpacity);
    const bgColor = hexToRgba(s.backgroundColor, s.backgroundOpacity);
    const winColor = hexToRgba(s.windowColor, s.windowOpacity);
    const edgeShadow = getEdgeStyleCSS(s.edgeStyle, 'rgba(0, 0, 0, 0.8)');
    const isSmallCaps = s.fontFamily === 'small-caps';

    // Window box carries the window color/opacity.
    this.windowEl.style.backgroundColor = winColor;

    const spans = this.windowEl.querySelectorAll<HTMLElement>('[part="cue"]');
    spans.forEach((span) => {
      span.style.fontSize = `${base * fontScale}px`;
      span.style.color = textColor;
      span.style.backgroundColor = bgColor;
      span.style.textShadow = edgeShadow;
      span.style.fontFamily = isSmallCaps ? 'sans-serif' : s.fontFamily;
      span.style.fontVariant = isSmallCaps ? 'small-caps' : 'normal';
    });
  }

  /**
   * Applies the current position to the container: X as a percentage (centered via the
   * Style_Layer's `translateX(-50%)`), Y as a distance from the BOTTOM in px so the margin to the
   * control bar / player bottom stays constant across player sizes. `top` is cleared so `bottom`
   * governs the vertical placement.
   */
  private applyPosition(): void {
    if (this.container === null) {
      return;
    }
    this.container.style.left = `${this.posX}%`;
    this.container.style.top = 'auto';
    this.container.style.bottom = `${this.posBottom}px`;
  }

  /** The resting bottom offset (px) for the current controls-visibility + fullscreen state. */
  private restBottom(): number {
    if (this.controlsHidden) {
      return REST_BOTTOM_HIDDEN;
    }
    return this.isFullscreen ? REST_BOTTOM_CONTROLS_FS : REST_BOTTOM_CONTROLS;
  }

  /**
   * Re-positions the caption box when the controls' visibility changes (parity with the original
   * effect keyed on `areControlsVisible`): if the user has NOT manually dragged, the box rests at
   * the default bottom offset for the current state — just above the control bar when visible, near
   * the bottom (with margin) when hidden — so the captions "rise" with the control bar and "drop"
   * toward the bottom when it hides. If the user HAS dragged, the box keeps its chosen offset but
   * is clamped so it never sits under the control bar. The CSS `bottom` transition animates it.
   */
  private syncPositionToControls(): void {
    const minBottom = this.restBottom();
    if (this.userDragged) {
      // Keep the user's chosen offset but never let it sit UNDER the control bar: the smallest
      // allowed bottom offset is the current resting line (parity: `Math.min(prev.y, maxY)`).
      this.posBottom = Math.max(this.posBottom, minBottom);
    } else {
      // Auto-rest just above the control bar (visible) or near the bottom (hidden).
      this.posX = 50;
      this.posBottom = minBottom;
    }
    this.applyPosition();
  }

  /**
   * Reads the controller host's `data-hiding` attribute into `controlsHidden` and re-positions.
   * The controller reflects `data-hiding` when the auto-hide timer fades the controls out, so
   * this keeps the captions in sync with the control bar's visibility.
   */
  private updateControlsHidden(): void {
    const hidden = this.stage?.hasAttribute('data-hiding') ?? false;
    if (hidden === this.controlsHidden) {
      return;
    }
    this.controlsHidden = hidden;
    this.syncPositionToControls();
  }

  /**
   * Clamps a candidate drag position (in percent of the stage) so the box stays on screen and
   * clear of the top bar / bottom timeline / center play-button zone (parity with the original
   * drag clamps). Returns the X in percent and the Y as a distance from the BOTTOM in px (matching
   * the positioning model). `stageHeight` converts the percent Y and the resting margins to px.
   */
  private clampPosition(xPct: number, yPct: number, stageHeight: number): { x: number; bottom: number } {
    const controlsVisible = !this.controlsHidden;
    const halfW = 20;
    const nx = Math.max(halfW, Math.min(100 - halfW, xPct));

    // Vertical bounds in px-from-bottom: the box may go as HIGH as MIN_TOP from the top (a large
    // bottom offset) and no LOWER than the current resting line (the smallest bottom offset).
    const minBottom = this.restBottom();
    const maxBottom = Math.max(minBottom, stageHeight - MIN_TOP);

    // Convert the pointer's top-percent to a bottom-px offset, then clamp.
    let bottom = stageHeight - (yPct / 100) * stageHeight;
    bottom = Math.max(minBottom, Math.min(maxBottom, bottom));

    // Push out of the center play-button zone while controls are visible (compare in percent).
    if (controlsVisible && nx > CENTER_ZONE.xMin && nx < CENTER_ZONE.xMax) {
      const yFromTopPct = ((stageHeight - bottom) / stageHeight) * 100;
      if (yFromTopPct > CENTER_ZONE.yMin && yFromTopPct < CENTER_ZONE.yMax) {
        // Move it just below the center zone (toward the bottom): a smaller top-% -> ... actually
        // push it DOWN to the zone's lower edge so it doesn't cover the play button.
        const pushedTopPct = CENTER_ZONE.yMax;
        bottom = stageHeight - (pushedTopPct / 100) * stageHeight;
        bottom = Math.max(minBottom, Math.min(maxBottom, bottom));
      }
    }
    return { x: nx, bottom };
  }

  /**
   * Wires the drag handlers on the container. A press starts a drag; document-level move/up
   * handlers reposition the box in percent of the stage until release. On release, if the box
   * was dropped within ~6% of the resting line it "snaps back" to auto-positioning.
   */
  private wireDragging(stage: HTMLElement): void {
    if (this.container === null) {
      return;
    }
    const container = this.container;

    const onPointerDown = (event: PointerEvent): void => {
      this.dragging = true;
      this.userDragged = true;
      container.style.transition = 'none';
      event.preventDefault();
      const move = (e: PointerEvent): void => {
        if (!this.dragging) return;
        const rect = stage.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const clamped = this.clampPosition(x, y, rect.height);
        this.posX = clamped.x;
        this.posBottom = clamped.bottom;
        this.applyPosition();
      };
      const up = (): void => {
        this.dragging = false;
        container.style.transition = '';
        // Snap back to auto-positioning when dropped near the resting line (parity with the
        // original `onDragEnd`: within ~24px of the resting bottom -> re-enable auto-positioning).
        const restBottom = this.restBottom();
        if (Math.abs(this.posBottom - restBottom) < 24) {
          this.userDragged = false;
          this.posX = 50;
          this.posBottom = restBottom;
          this.applyPosition();
        }
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    };
    container.addEventListener('pointerdown', onPointerDown);
    this.dragDisposers.push(() => container.removeEventListener('pointerdown', onPointerDown));
  }

  /**
   * Builds the Markup_Contract: a `part="captions"` draggable overlay container holding a
   * `part="caption-window"` box that receives the per-cue `part="cue"` spans.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('part', 'captions');

    const windowEl = document.createElement('div');
    windowEl.setAttribute('part', 'caption-window');

    container.appendChild(windowEl);

    this.container = container;
    this.windowEl = windowEl;

    this.root.appendChild(container);

    const state = this.store?.getState();
    if (state !== undefined) {
      this.seek = state.seek;
      this.isFullscreen = state.isFullScreen;
    }

    // The stage is the controller host (the offsetParent for percent positioning). Fall back to
    // this element's parent if not found. Drag handlers reposition relative to the stage, and the
    // stage's `data-hiding` drives the controls-visibility auto-positioning.
    const stage = (this.closest('playerstack-media-controller') as HTMLElement | null) ?? this.parentElement ?? this;
    this.stage = stage;

    // Seed the controls-hidden state from the stage BEFORE the first paint so the resting offset
    // is correct on mount, then apply the position + paint the cue.
    this.controlsHidden = stage.hasAttribute('data-hiding');
    this.posBottom = this.restBottom();
    this.applyPosition();
    this.updateActiveCue();

    this.wireDragging(stage);

    // Observe the controller host's `data-hiding` so the captions rise/drop with the control bar
    // (parity with the original effect on `areControlsVisible`). The observer is cheap (single
    // attribute filter) and cleaned up on disconnect.
    const observer = new MutationObserver(() => this.updateControlsHidden());
    observer.observe(stage, { attributes: true, attributeFilter: ['data-hiding'] });
    this.hidingObserver = observer;
  }

  /** Clears drag listeners + the hiding observer before the base cleanup. */
  override disconnectedCallback(): void {
    for (const dispose of this.dragDisposers) {
      dispose();
    }
    this.dragDisposers = [];
    if (this.hidingObserver !== null) {
      this.hidingObserver.disconnect();
      this.hidingObserver = null;
    }
    this.stage = null;
    super.disconnectedCallback();
  }
}
