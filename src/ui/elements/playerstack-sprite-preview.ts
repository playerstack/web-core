/**
 * `playerstack-sprite-preview` — the full-player-area sprite/thumbnail preview shown while the
 * user scrubs the progress bar (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * This is REUSABLE UI, so its markup lives in Core as a Custom Element (not in a skin): it renders
 * a `part="sprite-preview"` container holding one `part="sprite-preview-frame"` whose CSS
 * `background-*` is set to a single sprite frame. The frame-selection MATH is the shared pure
 * `computeSpriteFrame`; the only I/O (fetching the VTT, measuring sheet images, reading the
 * container pixel size) is supplied by an injected `SpriteAdapter`, so Core never touches
 * `fetch`/`Image`/`offsetWidth` directly and any skin (web/native) plugs in its own I/O.
 *
 * Inputs (property channel, set by the skin):
 *   - `adapter` — the `SpriteAdapter` (fetch VTT / measure sheets / container size).
 *   - `spriteVttFile` — the VTT index URL; assigning it (re)loads + parses the sprite cues.
 *   - `duration` / `seekTime` — the hovered position used to pick the frame.
 *   - `visible` — whether the preview is shown (driven by the skin's `seeking`).
 *
 * It reflects `data-visible` on the host so the Style_Layer shows/hides it, and paints the frame
 * `background-image`/`-size`/`-position` inline. It renders nothing extra when there is no VTT.
 */
import type { SpriteAdapter, SpriteSheetSizes } from '@typings/adapters.types';
import type { SpriteCue, ComputedSpriteFrame } from '@typings/sprite.types';
import type { SpritePreviewPart } from '@typings/ui/playerstack-sprite-preview.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { parseSpriteVTT } from '@utils/vtt-sprite';
import { computeSpriteFrame } from '@sprite';

export class PlayerstackSpritePreview extends PlayerstackElement {
  /** Injected platform I/O. Until set, the preview cannot load and stays hidden. */
  private _adapter: SpriteAdapter | null = null;

  /** The current sprite VTT index URL. Assigning it (re)loads the cues. */
  private _spriteVttFile: string | null = null;

  /** Hovered position + total duration used to select the frame. */
  private _duration = 0;
  private _seekTime = 0;

  /** Whether the preview is shown (skin's `seeking`). */
  private _visible = false;

  /** Parsed sprite cues (numeric) + measured sheet sizes, from the last successful load. */
  private cues: SpriteCue[] = [];
  private sheetSizes: SpriteSheetSizes = {};

  /** Increments per load so a stale async load can be discarded (no cancel token needed). */
  private loadToken = 0;

  /** Rendered nodes; kept so `render` stays idempotent and paints target them. */
  private container: HTMLElement | null = null;
  private frame: HTMLElement | null = null;

  // ─── Public inputs (property channel) ─────────────────────

  set adapter(value: SpriteAdapter | null) {
    this._adapter = value;
    this.loadSprite();
  }

  get adapter(): SpriteAdapter | null {
    return this._adapter;
  }

  set spriteVttFile(value: string | null) {
    const next = value ?? null;
    if (next === this._spriteVttFile) return;
    this._spriteVttFile = next;
    this.loadSprite();
  }

  get spriteVttFile(): string | null {
    return this._spriteVttFile;
  }

  set duration(value: number) {
    this._duration = value ?? 0;
    this.paint();
  }

  get duration(): number {
    return this._duration;
  }

  set seekTime(value: number) {
    this._seekTime = value ?? 0;
    this.paint();
  }

  get seekTime(): number {
    return this._seekTime;
  }

  set visible(value: boolean) {
    this._visible = Boolean(value);
    this.paint();
  }

  get visible(): boolean {
    return this._visible;
  }

  // ─── Rendering ────────────────────────────────────────────

  /**
   * Builds the Markup_Contract: a `part="sprite-preview"` container holding a single
   * `part="sprite-preview-frame"`. Nodes are APPENDED (never via `innerHTML`) so the adopted
   * Style_Layer survives. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }
    const containerPart: SpritePreviewPart = 'sprite-preview';
    const container = document.createElement('div');
    container.setAttribute('part', containerPart);
    container.setAttribute('data-visible', 'false');

    const framePart: SpritePreviewPart = 'sprite-preview-frame';
    const frame = document.createElement('div');
    frame.setAttribute('part', framePart);
    frame.style.display = 'none';

    container.appendChild(frame);
    this.container = container;
    this.frame = frame;

    this.root.appendChild(container);
    this.paint();
  }

  // ─── Load + paint ─────────────────────────────────────────

  /**
   * (Re)loads and parses the sprite VTT via the adapter, then measures its sheet images. Guarded
   * by a load token so a late-resolving previous load can't overwrite a newer one. Relative image
   * paths in the VTT are resolved against the VTT file's base URL (pure string step). Repaints on
   * success.
   */
  private loadSprite(): void {
    const url = this._spriteVttFile;
    const adapter = this._adapter;
    const token = ++this.loadToken;
    this.cues = [];
    this.sheetSizes = {};
    if (!url || !adapter) {
      this.paint();
      return;
    }
    void (async () => {
      try {
        const vttString = await adapter.fetchVtt(url);
        if (token !== this.loadToken) return;
        const resolved = PlayerstackSpritePreview.resolveVttImagePaths(vttString, url);
        const parsed = parseSpriteVTT(resolved);
        const numericCues: SpriteCue[] = parsed.map((item) => ({
          from: item.from,
          to: item.to,
          x: Number(item.x),
          y: Number(item.y),
          w: Number(item.w),
          h: Number(item.h),
          file: item.file,
        }));
        const urls = [...new Set(numericCues.map((c) => c.file))];
        const sizes = await adapter.loadSheetSizes(urls);
        if (token !== this.loadToken) return;
        this.cues = numericCues;
        this.sheetSizes = sizes;
        this.paint();
      } catch {
        // Network/parse failure: leave the preview empty (it just won't show).
        if (token === this.loadToken) {
          this.cues = [];
          this.paint();
        }
      }
    })();
  }

  /**
   * Resolves relative sprite-sheet image paths in a VTT string to absolute URLs using the VTT
   * file's base URL (pure string transform, framework-agnostic). Lines that are already absolute
   * (http/https) are left untouched.
   */
  private static resolveVttImagePaths(vttString: string, vttUrl: string): string {
    const baseUrl = vttUrl.substring(0, vttUrl.lastIndexOf('/') + 1);
    return vttString.replace(/^([^#?\n]+\.(png|jpg|jpeg|webp))/gim, (match) =>
      match.startsWith('http') ? match : `${baseUrl}${match}`,
    );
  }

  /**
   * Selects + paints the frame for the current `seekTime` using the shared `computeSpriteFrame`
   * math and the adapter's container size, and reflects `data-visible`. Hides the frame when not
   * visible, when there are no cues, or when no frame matches the current time.
   */
  private paint(): void {
    if (this.container === null || this.frame === null) {
      return;
    }
    const frameStyle = this.computeFrameStyle();
    const show = this._visible && frameStyle !== null;
    this.container.setAttribute('data-visible', show ? 'true' : 'false');
    if (show && frameStyle !== null) {
      this.frame.style.display = '';
      this.frame.style.backgroundImage = `url(${frameStyle.file})`;
      this.frame.style.backgroundSize = `${frameStyle.bgW}px ${frameStyle.bgH}px`;
      this.frame.style.backgroundPosition = `${frameStyle.bgPosX + frameStyle.offsetX}px ${frameStyle.bgPosY + frameStyle.offsetY}px`;
    } else {
      this.frame.style.display = 'none';
    }
  }

  /** Runs the shared frame math for the current inputs, or returns null when not paintable. */
  private computeFrameStyle(): ComputedSpriteFrame | null {
    if (!this._visible || this.cues.length === 0 || this._duration <= 0 || this._adapter === null) {
      return null;
    }
    const { width, height } = this._adapter.getContainerSize();
    if (!width || !height) return null;
    return computeSpriteFrame(this.cues, this._seekTime, { width, height }, this.sheetSizes);
  }
}
