/**
 * `playerstack-time-slider` — the progress slider with a hover time tooltip and an optional
 * timelens thumbnail preview (Req 1.4, 1.5, 1.6, 2.1, 3.3, 5.1, 5.3).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element directly. A click/pointer release on the track expresses a seek intent via a
 * `playerstack-seek-request` DOM event that the `MediaController` routes to the
 * `PlayerAdapter` (Req 2.1). Playback progress flows back through the shared store; the
 * element mirrors the played fraction into the `part="track-fill"` width and the loaded
 * fraction into `part="track-buffered"` so the Style_Layer only paints the fills (Req 3.3).
 *
 * The hover geometry reuses the SAME pure helpers as the headless layer (Req 1.6):
 * `getTimeFromSliderPosition` (from `@slider`) converts a pointer X into a time, and
 * `computeTimelensFrame` (from `@sprite`) computes the NATIVE 1:1 timelens frame geometry —
 * keeping the visual preview consistent with the rest of Core without duplicating math here.
 *
 * Timelens I/O ownership mirrors `playerstack-sprite-preview`: fetching + parsing the sprite VTT
 * lives IN this element behind an injected `SpriteAdapter` (only `fetchVtt` is needed since the
 * thumbnail is rendered at the cue's native pixel size, not cover-scaled). The skin supplies the
 * platform I/O (`fetch`) and the `sprite-vtt-file` URL; the element resolves + parses the cues
 * and, on hover, sizes `[part='timelens']` to the matched cue and offsets the sheet by `-x`/`-y`
 * (parity with the original desktop `Timelens`). A consumer can alternatively hand pre-parsed
 * cues through the direct `spriteData` property (kept for tests/consumers with their own I/O).
 * With neither an adapter+URL nor `spriteData`, the timelens stays hidden.
 *
 * Accessibility (Req 1.5): the slider region exposes a configurable accessible name through
 * the `aria-label` attribute; when the consumer omits it, the default English label applies.
 */
import type { TimeSliderDefaultLabel, TimeSliderSpriteData } from '@typings/ui/playerstack-time-slider.types';
import type { ChaptersInput } from '@typings/ui/playerstack-chapters.types';
import type { ChapterInput, ChapterSegment } from '@typings/chapters.types';
import type { SeekRequestDetail, ScrubbingRequestDetail } from '@typings/ui/media-controller.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { SpriteAdapter } from '@typings/adapters.types';
import type { SpriteCue } from '@typings/sprite.types';
import type { HeatmapDataPoint } from '@typings/heatmap.types';
import type { HeatmapInput } from '@typings/ui/playerstack-heatmap.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { getTimeFromSliderPosition } from '@slider';
import { computeChapterSegments, getChapterAtTime } from '@chapters';
import { computeTimelensFrame } from '@sprite';
import { generateHeatmapPath } from '@heatmap';
import { parseSpriteVTT } from '@utils/vtt-sprite';

/** SVG namespace URI required so `createElementNS` yields real, rendered SVG nodes. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Fixed viewBox matching the 0-100 coordinate space `generateHeatmapPath` emits. */
const HEATMAP_VIEW_BOX = '0 0 100 100';

/** Monotonic sequence for unique per-instance heatmap clip ids (multiple players on one page). */
let heatmapClipSeq = 0;
import { formatTime } from '@utils/format';
import { formatLiveOffset } from '@live-dvr';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: TimeSliderDefaultLabel = 'Seek';

export class PlayerstackTimeSlider extends PlayerstackElement {
  /**
   * Declares `aria-label` (accessible name, Req 1.5) and `sprite-vtt-file` (an optional
   * timelens source hint the consuming adapter resolves into `spriteData`) as observed
   * attributes so both are configurable via markup. Keying the schema by readable prop
   * names while mapping to the concrete attributes drives `observedAttributes` from the
   * schema.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
    spriteVtt: { attribute: 'sprite-vtt-file', type: 'string' },
    bufferMode: { attribute: 'buffer-mode', type: 'string' },
  } as const;

  /** Latest total duration (seconds) mirrored from the store; drives hover-time + fills. */
  private duration = 0;

  /** Latest seek position (seconds) mirrored from the store; drives the played fill. */
  private seek = 0;

  /** Latest loaded position (seconds) mirrored from the store; drives the buffered fill. */
  private loaded = 0;

  /** Latest buffered time ranges from the store; drives multi-range buffer visualization. */
  private bufferedRanges: Array<{ start: number; end: number }> = [];

  /** Rendered buffer-range elements for fragmented mode; recycled on each update. */
  private bufferRangeEls: HTMLElement[] = [];

  /**
   * Buffer visualization mode:
   * - `'fragmented'` (default): shows ALL individual buffer segments from the SourceBuffer.
   * - `'current'`: shows only the range containing the current playback position (YouTube-style).
   * - `'classic'`: shows a single bar from 0 to `loaded`.
   */
  private get bufferMode(): 'fragmented' | 'current' | 'classic' {
    const attr = this.getAttribute('buffer-mode');
    if (attr === 'classic') return 'classic';
    if (attr === 'current') return 'current';
    return 'fragmented';
  }

  /**
   * Sprite data supplied directly by the consumer/adapter to enable the timelens preview
   * WITHOUT the element doing its own I/O. `null` keeps this channel off; a value seeds the
   * timelens `cues`. The preferred path is `adapter` + `sprite-vtt-file` (the element resolves
   * the VTT itself, mirroring `playerstack-sprite-preview`), but this direct channel is kept so
   * a consumer can hand pre-parsed cues and so existing tests keep working (Req 1.6).
   */
  private _spriteData: TimeSliderSpriteData | null = null;

  /**
   * Injected platform I/O for resolving the sprite VTT (fetch text). Only `fetchVtt` is used —
   * the timelens renders NATIVE 1:1 frames, so no sheet measuring or container sizing is needed
   * (unlike `playerstack-sprite-preview`, which cover-scales). Until set, the element relies on
   * the direct `spriteData` channel instead.
   */
  private _spriteAdapter: SpriteAdapter | null = null;

  /** The current sprite VTT index URL (from the `sprite-vtt-file` attribute). */
  private _spriteVttFile: string | null = null;

  /** Parsed sprite cues (numeric) used by the timelens; from the adapter load or `spriteData`. */
  private cues: SpriteCue[] = [];

  /** Increments per VTT load so a stale async load can be discarded (no cancel token needed). */
  private spriteLoadToken = 0;

  /**
   * Ad-mode flag (default `false`). When `true` the slider becomes the AD progress bar (parity
   * with the original `TimeSlider adMode`): the played fill turns yellow (`#fc0`, driven by the
   * controller-host `[data-ad-active]` Style_Layer hook the skin reflects), the handle/thumb is
   * hidden, the cursor is default, and NO chapter segments render — chapter markers are ignored
   * for as long as the ad plays. Returning to `false` restores chapters + handle + the normal
   * red fill.
   */
  private _adMode = false;

  /**
   * Live-DVR flag (default `false`). When `true` the hover/scrub tooltip shows the NEGATIVE live
   * offset (e.g. `-05:26`) instead of an absolute time — parity with the original desktop
   * `TimeTooltip` live branch. The skin already feeds the store the DVR WINDOW (position as
   * `seek`, window length as `duration`), so the offset is `time - duration` (0 at the edge).
   */
  private _live = false;

  /** The rendered slider region; kept so `render` stays idempotent across reconnects. */
  private slider: HTMLElement | null = null;

  /** The rendered played-fill element whose width mirrors `seek / duration` (Req 3.3). */
  private trackFill: HTMLElement | null = null;

  /** The rendered buffered-fill element whose width mirrors `loaded / duration` (Req 3.3). */
  private trackBuffered: HTMLElement | null = null;

  /** The rendered hover-highlight element showing the seek preview range (YouTube-style). */
  private trackHover: HTMLElement | null = null;

  /** The rendered handle/thumb; its `left` rides the end of the played fill (Req 3.3). */
  private thumb: HTMLElement | null = null;

  /** The rendered hover-time tooltip (TimeTooltip / StyledTip container). */
  private tooltip: HTMLElement | null = null;

  /** The rendered tooltip time line (StyledTip text) — shows the hovered TIME. */
  private tooltipTime: HTMLElement | null = null;

  /**
   * The rendered tooltip chapter label (StyledChapterLabel) — shows the hovered chapter TITLE
   * when chapters exist. Hidden (empty text) when there is no chapter at the hovered time.
   */
  private tooltipChapter: HTMLElement | null = null;

  /** The rendered timelens thumbnail preview; hidden until `spriteData` is assigned. */
  private timelens: HTMLElement | null = null;

  /** Heatmap ("most replayed") data points; drives the `[part='heatmap']` curve over the slider. */
  private heatmapPoints: HeatmapDataPoint[] = [];

  /** The rendered heatmap container (`[part='heatmap']`); hidden until data is assigned. */
  private heatmap: HTMLElement | null = null;

  /** The base (dim) heatmap `<path>` tracing the full curve. */
  private heatmapPath: SVGPathElement | null = null;

  /** The played (bright) heatmap `<path>`, clipped to the played fraction. */
  private heatmapPlayedPath: SVGPathElement | null = null;

  /** The `<rect>` inside the played clip whose width mirrors the played percentage (0-100). */
  private heatmapClipRect: SVGRectElement | null = null;

  /**
   * The rendered chapter-segments overlay. Holds the per-chapter divider divs when chapter
   * markers are supplied; empty (and visually inert) otherwise.
   */
  private chaptersOverlay: HTMLElement | null = null;

  /** Raw chapter markers supplied by the consumer/adapter; drive the segment dividers. */
  private markers: ChapterInput[] = [];

  /**
   * Computed chapter segments (via `computeChapterSegments`) reused across store updates so the
   * per-segment fills and the hovered-chapter lookup run against the pre-computed boundaries.
   * Empty when there are no markers / no duration — the plain track then carries the fills.
   */
  private segments: ChapterSegment[] = [];

  /**
   * Per-segment fill element refs, index-aligned with `segments`. Each entry holds the
   * `chapter-segment` block plus its own buffered + played fill divs so `updateFills` can paint
   * each segment's progress per the original ChapterSegments formulas without rebuilding the DOM.
   */
  private segmentEls: Array<{
    block: HTMLElement;
    buffered: HTMLElement;
    hover: HTMLElement;
    filled: HTMLElement;
  }> = [];

  /**
   * Index of the chapter segment currently under the pointer, or `-1` when none. Mirrors the
   * original `hoveredIndex` so the hovered block scales up (`scaleY`) via the Style_Layer.
   */
  private hoveredIndex = -1;

  /**
   * `true` while the user is actively scrubbing (pointer pressed on the slider). During a
   * drag the played fill + thumb follow the pointer OPTIMISTICALLY and the store's playback
   * position is ignored, matching the original `timeSliderSliding` behavior.
   */
  private dragging = false;

  /** `true` if the pointer moved during the current drag (distinguishes a real drag from a tap). */
  private dragMoved = false;

  /**
   * Optimistic seek time (seconds) while dragging. Mirrors the original `timeSliderState.value`
   * so the fill/thumb/tooltip track the pointer before the release commits the seek.
   */
  private dragTime = 0;

  /**
   * Public setter/property to enable the timelens preview. Assigning parsed cues + sheet
   * sizes turns the timelens on; assigning `null` hides it again. The actual VTT fetch and
   * image loading stay with the consumer/adapter (Req 1.6) — this element only wires the
   * geometry when data is provided.
   */
  set spriteData(data: TimeSliderSpriteData | null) {
    this._spriteData = data;
    // Direct channel: seed the timelens cues from the supplied data (numeric cues already).
    this.cues = data?.cues ?? [];
    // Hide the timelens immediately when data is removed; hovering re-shows it when present.
    if (data === null && this._spriteAdapter === null && this.timelens !== null) {
      this.timelens.style.display = 'none';
      this.timelens.removeAttribute('data-visible');
    }
  }

  get spriteData(): TimeSliderSpriteData | null {
    return this._spriteData;
  }

  /**
   * Public setter/property to supply the "most replayed" heatmap data points (Req 1.6). The
   * heatmap graph lives INSIDE the slider (like the tooltip/timelens/chapters) so it sits over
   * the timeline with the right offset, only shows on hover/scrub, and hides with the controls —
   * parity with the original `HeatmapGraph` that rendered inside the slider container. Assigning
   * points recomputes the SVG curve against the current duration and repaints. `null`/empty hides
   * it.
   */
  set heatmapData(input: HeatmapInput | null) {
    this.heatmapPoints = input ?? [];
    this.updateHeatmap();
  }

  get heatmapData(): HeatmapInput | null {
    return this.heatmapPoints;
  }

  /**
   * Public setter for the injected `SpriteAdapter`. Assigning it lets the element resolve the
   * sprite VTT itself (via `fetchVtt`) — the same ownership model as `playerstack-sprite-preview`
   * — so the skin only supplies platform I/O, not parsed data. Assigning it (re)loads the VTT.
   */
  set adapter(value: SpriteAdapter | null) {
    this._spriteAdapter = value ?? null;
    this.loadSprite();
  }

  get adapter(): SpriteAdapter | null {
    return this._spriteAdapter;
  }

  /**
   * Public setter for the sprite VTT index URL (also driven by the `sprite-vtt-file` attribute
   * via `onAttributeChanged`). Assigning it (re)loads + parses the cues when an adapter is present.
   */
  set spriteVttFile(value: string | null) {
    const next = value ?? null;
    if (next === this._spriteVttFile) return;
    this._spriteVttFile = next;
    this.loadSprite();
  }

  get spriteVttFile(): string | null {
    return this._spriteVttFile;
  }

  /**
   * Reacts to the observed `sprite-vtt-file` attribute (schema key `spriteVtt`): mirrors it into
   * `spriteVttFile` so an attribute-set URL triggers the same VTT load as the property channel.
   */
  protected override onAttributeChanged(propKey: string, value: string | number | boolean): void {
    if (propKey === 'spriteVtt') {
      this.spriteVttFile = value === '' || value === false ? null : String(value);
    }
    if (propKey === 'bufferMode') {
      // Mode changed: repaint fills so the correct visualization renders immediately.
      this.updateFills();
    }
  }

  /**
   * (Re)loads and parses the sprite VTT via the adapter (fetch text → resolve relative image
   * paths → `parseSpriteVTT` → numeric cues), guarded by a load token so a late-resolving load
   * can't overwrite a newer one. The timelens is NATIVE 1:1 so no sheet sizes are measured. When
   * there is no adapter or URL the element falls back to whatever the direct `spriteData` channel
   * provided. Hides the timelens when cues are cleared.
   */
  private loadSprite(): void {
    const url = this._spriteVttFile;
    const adapter = this._spriteAdapter;
    const token = ++this.spriteLoadToken;
    if (!url || !adapter) {
      // No self-resolution: keep any cues from the direct `spriteData` channel.
      this.cues = this._spriteData?.cues ?? [];
      if (this.cues.length === 0 && this.timelens !== null) {
        this.timelens.style.display = 'none';
      }
      return;
    }
    void (async () => {
      try {
        const vttString = await adapter.fetchVtt(url);
        if (token !== this.spriteLoadToken) return;
        const resolved = PlayerstackTimeSlider.resolveVttImagePaths(vttString, url);
        const parsed = parseSpriteVTT(resolved);
        this.cues = parsed.map((item) => ({
          from: item.from,
          to: item.to,
          x: Number(item.x),
          y: Number(item.y),
          w: Number(item.w),
          h: Number(item.h),
          file: item.file,
        }));
      } catch {
        // Network/parse failure: leave the timelens empty (it just won't show).
        if (token === this.spriteLoadToken) {
          this.cues = [];
          if (this.timelens !== null) {
            this.timelens.style.display = 'none';
          }
        }
      }
    })();
  }

  /**
   * Resolves relative sprite-sheet image paths in a VTT string to absolute URLs using the VTT
   * file's base URL (pure string transform, framework-agnostic). Lines already absolute
   * (http/https) are left untouched. Mirrors the original desktop Timelens resolution.
   */
  private static resolveVttImagePaths(vttString: string, vttUrl: string): string {
    const baseUrl = vttUrl.substring(0, vttUrl.lastIndexOf('/') + 1);
    return vttString.replace(/^([^#?\n]+\.(png|jpg|jpeg|webp))/gim, (match) =>
      match.startsWith('http') ? match : `${baseUrl}${match}`,
    );
  }

  /**
   * Public setter/property to supply the raw chapter markers rendered as segment dividers on
   * the timeline (Req 1.6, 3.3). Assigning markers rebuilds the `part="chapters"` overlay via
   * the shared `computeChapterSegments` against the current duration so the timeline is split
   * into chapters exactly like the original `ChapterSegments`. Assigning `null`/empty clears it.
   */
  set chapters(input: ChaptersInput | null) {
    this.markers = input ?? [];
    this.renderChapterSegments();
  }

  get chapters(): ChaptersInput | null {
    return this.markers;
  }

  /**
   * Public setter for the ad-mode flag (default `false`). Toggling it repaints the slider as the
   * ad progress bar or restores the normal timeline: it hides/shows the thumb + sets the cursor,
   * and rebuilds the chapter overlay (which becomes a no-op / hidden while `adMode` is true so no
   * chapter segments show during an ad). Coerced to a boolean for predictable prop assignment.
   */
  set adMode(value: boolean) {
    const next = Boolean(value);
    if (next === this._adMode) {
      return;
    }
    this._adMode = next;
    this.applyAdMode();
    // Rebuild the chapter overlay so segments disappear in ad mode (and reappear when it ends),
    // then repaint the fills so the plain (yellow) track carries the ad progress.
    this.renderChapterSegments();
    this.updateFills();
  }

  get adMode(): boolean {
    return this._adMode;
  }

  /**
   * Public setter for the live-DVR flag (default `false`). When `true` the hover/scrub tooltip
   * renders the negative live offset instead of an absolute time (parity with the original
   * desktop `TimeTooltip` live branch). Coerced to a boolean for predictable prop assignment.
   */
  set live(value: boolean) {
    this._live = Boolean(value);
  }

  get live(): boolean {
    return this._live;
  }

  /**
   * Applies the ad-mode visual gating that the element owns directly (independent of the
   * controller-host CSS hook): hides the handle/thumb and sets the slider cursor to `default`
   * while an ad plays, restoring both when the ad ends. The yellow played fill is driven by the
   * Style_Layer via the controller host `[data-ad-active]`, so it is not set here.
   */
  private applyAdMode(): void {
    if (this.thumb !== null) {
      this.thumb.style.display = this._adMode ? 'none' : '';
    }
    if (this.slider !== null) {
      this.slider.style.cursor = this._adMode ? 'default' : '';
    }
  }

  /**
   * Tracks the progress fields this element cares about and repaints the played + buffered
   * fills. Only the subset needed is read, per the base class's opt-in `onStoreChange`
   * design; no host `data-*` toggling is required for the slider itself.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    // Chapter segment boundaries depend on the total duration, so rebuild the dividers when it
    // changes (mirrors the original ChapterSegments recomputing off `duration`).
    const durationChanged = state.duration !== this.duration;
    const seekChanged = state.seek !== this.seek;
    this.duration = state.duration;
    this.seek = state.seek;
    this.loaded = state.loaded;
    this.bufferedRanges = state.bufferedRanges || [];
    if (durationChanged) {
      this.renderChapterSegments();
      // The heatmap x-coordinates scale by duration, so recompute the curve when it changes.
      this.updateHeatmap();
    }
    // Playback progress drives the bright heatmap played-overlay clip.
    if (seekChanged) {
      this.updateHeatmapClip();
    }
    this.updateFills();
  }

  /**
   * Recomputes the heatmap SVG stroke `d` from the tracked points + duration via the shared
   * `generateHeatmapPath` (Req 1.6), writes it onto both the base and played paths, and toggles
   * `[part='heatmap']` visibility via a `data-active` attribute on the container when there is a
   * drawable curve. Guarded for the pre-render window.
   */
  private updateHeatmap(): void {
    if (this.heatmap === null || this.heatmapPath === null) {
      return;
    }
    const d = generateHeatmapPath(this.heatmapPoints, this.duration);
    this.heatmapPath.setAttribute('d', d);
    if (this.heatmapPlayedPath !== null) {
      this.heatmapPlayedPath.setAttribute('d', d);
    }
    // Toggle a data hook the Style_Layer keys off so an empty curve stays hidden.
    if (d.length > 0) {
      this.heatmap.setAttribute('data-active', 'true');
    } else {
      this.heatmap.removeAttribute('data-active');
    }
    this.updateHeatmapClip();
  }

  /**
   * Sizes the played-overlay clip `<rect>` to the played fraction (0-100 in the SVG's 0-100
   * space) so the bright heatmap stroke reveals only up to the current position (parity with the
   * original HeatmapGraph clip). Guarded for the pre-render window and a zero/unknown duration.
   */
  private updateHeatmapClip(): void {
    if (this.heatmapClipRect === null) {
      return;
    }
    const percent = this.duration > 0 ? Math.min(100, Math.max(0, (this.seek / this.duration) * 100)) : 0;
    this.heatmapClipRect.setAttribute('width', String(percent));
  }

  /**
   * Sets the played + buffered fill widths and positions the thumb (Req 1.6, 3.3). The played
   * fraction is `seek / duration` and the buffered fraction is `loaded / duration`, both
   * guarded so a zero/unknown duration yields `0%` instead of a division by zero. WHILE the
   * user is scrubbing the played fill + thumb follow the OPTIMISTIC `dragTime` instead of the
   * store's `seek`, matching the original `timeSliderSliding` behavior; the buffered fill keeps
   * tracking the real loaded position. The thumb rides the RIGHT EDGE of the played fill (the
   * original pinned the handle to the end of the red progress track), so its `left` mirrors the
   * played fraction.
   */
  private updateFills(): void {
    const playedTime = this.dragging ? this.dragTime : this.seek;
    // In live mode with no usable duration yet (0 or Infinity from native HLS live), show full bar.
    const playedFraction =
      this._live && (this.duration <= 0 || !isFinite(this.duration))
        ? 1
        : this.clampFraction(this.duration > 0 ? playedTime / this.duration : 0);
    const bufferedFraction = this.clampFraction(this.duration > 0 ? this.loaded / this.duration : 0);
    const hasChapters = this.segments.length > 0 && this.duration > 0;

    // When chapters exist the per-segment fills carry the progress, so the plain track-fill /
    // buffered must NOT double-paint (the original hid them by rendering the segments in place
    // of the plain rail). Set their widths to 0 so only the segments show progress.
    if (this.trackFill !== null) {
      this.trackFill.style.width = hasChapters ? '0%' : `${playedFraction * 100}%`;
    }

    // Buffer visualization: fragmented/current modes paint individual range segments;
    // classic mode paints a single bar from 0% to `loaded/duration`. In fragmented/current
    // mode the single track-buffered is hidden and per-range divs are used instead.
    // When chapters exist, ALL modes use per-segment fills (chapter-segment-buffered) to
    // respect the chapter gap divisions — the global buffer-range divs would cross gaps.
    const isFragmented = this.bufferMode !== 'classic';
    if (this.trackBuffered !== null) {
      if (isFragmented || hasChapters) {
        this.trackBuffered.style.width = '0%';
      } else {
        this.trackBuffered.style.width = `${bufferedFraction * 100}%`;
      }
    }

    // Paint fragmented/current buffer range segments ONLY when no chapters (ranges cross gaps).
    // With chapters the per-segment fills handle it below via updateSegmentFills.
    if (isFragmented && !hasChapters && this.duration > 0) {
      this.updateBufferRanges();
    } else {
      this.clearBufferRanges();
    }

    // Position the handle at the played fraction so it rides the end of the played fill.
    if (this.thumb !== null) {
      this.thumb.style.left = `${playedFraction * 100}%`;
    }

    if (hasChapters) {
      this.updateSegmentFills(playedTime);
    }
  }

  /**
   * Paints individual buffer range segments (fragmented/current buffer visualization).
   * In `'fragmented'` mode ALL ranges are shown; in `'current'` mode (YouTube-style) only
   * the range containing the current playback position is shown. Recycles existing DOM
   * elements to avoid thrashing.
   */
  private updateBufferRanges(): void {
    const track = this.trackBuffered?.parentElement;
    if (track === null || track === undefined) return;

    const allRanges = this.bufferedRanges;
    const duration = this.duration;

    // In 'current' mode, filter to only the range that contains the playback position.
    let ranges: Array<{ start: number; end: number }>;
    if (this.bufferMode === 'current') {
      const pos = this.seek;
      const match = allRanges.filter((r) => pos >= r.start - 0.5 && pos <= r.end + 0.5);
      ranges = match.length > 0 ? match : [];
    } else {
      ranges = allRanges;
    }

    // Ensure we have the right number of range elements (recycle/create/remove).
    while (this.bufferRangeEls.length < ranges.length) {
      const el = document.createElement('div');
      el.setAttribute('part', 'buffer-range');
      track.appendChild(el);
      this.bufferRangeEls.push(el);
    }
    while (this.bufferRangeEls.length > ranges.length) {
      const el = this.bufferRangeEls.pop()!;
      el.remove();
    }

    // Position each range element by left% and width%.
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]!;
      const el = this.bufferRangeEls[i]!;
      const left = (range.start / duration) * 100;
      const width = ((range.end - range.start) / duration) * 100;
      el.style.left = `${left}%`;
      el.style.width = `${width}%`;
    }
  }

  /** Removes all buffer-range elements from the DOM (used when switching to classic or chapters). */
  private clearBufferRanges(): void {
    for (const el of this.bufferRangeEls) {
      el.remove();
    }
    this.bufferRangeEls = [];
  }

  /**
   * Updates the hover highlight bar (YouTube-style seek preview): a tinted fill from the
   * current played position to the hovered time. Only visible when hovering AHEAD of the
   * played position (hovering behind shows nothing — like YouTube). When chapters exist,
   * the per-segment `chapter-segment-hover` fills are used instead of the track-level div.
   */
  private updateTrackHover(hoveredTime: number): void {
    const playedTime = this.dragging ? this.dragTime : this.seek;
    const hasChapters = this.segments.length > 0 && this.duration > 0;

    if (hasChapters) {
      // Paint per-segment hover fills using the same segmentFillPercent model.
      // The hover region spans from playedTime to hoveredTime within each segment.
      for (let i = 0; i < this.segments.length; i++) {
        const segment = this.segments[i]!;
        const refs = this.segmentEls[i];
        if (refs === undefined) continue;
        const segDur = segment.endTime - segment.startTime;
        if (hoveredTime <= playedTime || hoveredTime <= segment.startTime || playedTime >= segment.endTime) {
          refs.hover.style.width = '0%';
          refs.hover.style.left = '0%';
        } else {
          // Clamp played and hovered to segment boundaries.
          const hoverStart = Math.max(playedTime, segment.startTime);
          const hoverEnd = Math.min(hoveredTime, segment.endTime);
          if (hoverEnd <= hoverStart) {
            refs.hover.style.width = '0%';
            refs.hover.style.left = '0%';
          } else {
            const leftPct = ((hoverStart - segment.startTime) / segDur) * 100;
            const widthPct = ((hoverEnd - hoverStart) / segDur) * 100;
            refs.hover.style.left = `${leftPct}%`;
            refs.hover.style.width = `${widthPct}%`;
          }
        }
      }
      // Hide the track-level hover (chapters use their own).
      if (this.trackHover !== null) {
        this.trackHover.style.width = '0%';
      }
    } else {
      // No chapters: use the track-level hover div.
      if (this.trackHover === null || this.duration <= 0) return;
      if (hoveredTime <= playedTime) {
        this.trackHover.style.width = '0%';
        return;
      }
      const leftPct = (playedTime / this.duration) * 100;
      const widthPct = ((hoveredTime - playedTime) / this.duration) * 100;
      this.trackHover.style.left = `${leftPct}%`;
      this.trackHover.style.width = `${widthPct}%`;
    }
  }

  /** Hides the hover highlight (on pointer leave). */
  private hideTrackHover(): void {
    if (this.trackHover !== null) {
      this.trackHover.style.width = '0%';
    }
    // Also clear per-segment hover fills.
    for (const refs of this.segmentEls) {
      refs.hover.style.width = '0%';
      refs.hover.style.left = '0%';
    }
  }

  /**
   * Paints each chapter segment's OWN buffered + played fill per the original ChapterSegments
   * formulas (Req 1.6, 3.3): for a segment spanning `[start, end]` of duration `segDur`, the
   * played fill is 100% when `time >= end`, `((time - start) / segDur) * 100` when
   * `time > start`, else 0; the buffered fill applies the same formula against
   * `loaded` (the buffered time). Runs over the pre-built `segmentEls` refs so no DOM is rebuilt.
   */
  private updateSegmentFills(playedTime: number): void {
    const bufferedTime = this.loaded;
    // In fragmented/current mode, compute per-segment buffered fill from the REAL buffered
    // ranges. Use the furthest buffered endpoint within each segment as the fill target
    // (same left-anchored fill model as the played fill). This naturally shows buffer up to
    // where data actually exists in that segment, respecting chapter boundaries.
    // In classic mode, use the scalar `loaded` value (original behavior).
    const useRanges = this.bufferMode !== 'classic';
    const ranges = useRanges ? this.getEffectiveRanges() : null;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i]!;
      const refs = this.segmentEls[i];
      if (refs === undefined) {
        continue;
      }
      const segDur = segment.endTime - segment.startTime;
      refs.filled.style.width = `${this.segmentFillPercent(playedTime, segment.startTime, segment.endTime, segDur)}%`;

      if (useRanges && ranges !== null) {
        // Find the furthest buffered end within this segment.
        const maxEnd = this.maxBufferedEndInSegment(ranges, segment.startTime, segment.endTime);
        refs.buffered.style.width = `${this.segmentFillPercent(maxEnd, segment.startTime, segment.endTime, segDur)}%`;
      } else {
        refs.buffered.style.width = `${this.segmentFillPercent(bufferedTime, segment.startTime, segment.endTime, segDur)}%`;
      }
    }
  }

  /**
   * Returns the effective buffered ranges for the global buffer-range divs (no chapters).
   * 'current' filters to the range containing the playback position; 'fragmented' returns all.
   */
  private getEffectiveRanges(): Array<{ start: number; end: number }> {
    if (this.bufferMode === 'current') {
      const pos = this.seek;
      return this.bufferedRanges.filter((r) => pos >= r.start - 0.5 && pos <= r.end + 0.5);
    }
    return this.bufferedRanges;
  }

  /**
   * Finds the furthest buffered end point within a segment [segStart, segEnd].
   * Returns the absolute time of the max buffered end (clamped to segEnd), or 0 if no
   * range overlaps the segment.
   */
  private maxBufferedEndInSegment(
    ranges: Array<{ start: number; end: number }>,
    segStart: number,
    segEnd: number,
  ): number {
    let maxEnd = 0;
    for (const range of ranges) {
      if (range.end > segStart && range.start < segEnd) {
        const clampedEnd = Math.min(range.end, segEnd);
        if (clampedEnd > maxEnd) {
          maxEnd = clampedEnd;
        }
      }
    }
    return maxEnd;
  }

  /**
   * Computes a per-segment fill percentage for a given time against a segment `[start, end]`
   * (original ChapterSegments logic): 100 past the end, a linear share inside the segment, 0
   * before the start. Guards a zero-length segment to 0 to avoid a division by zero.
   */
  private segmentFillPercent(time: number, start: number, end: number, segDur: number): number {
    if (segDur <= 0) return 0;
    if (time >= end) return 100;
    if (time > start) return ((time - start) / segDur) * 100;
    return 0;
  }

  /**
   * Rebuilds the `part="chapters"` overlay: one `part="chapter-segment"` divider per computed
   * segment, its width the segment's share of the duration, laid out with gaps so the timeline
   * reads as discrete chapters (ported from the original `ChapterSegments`). The dividers are
   * purely visual (pointer-events disabled by the Style_Layer) so the slider stays seekable
   * through them. Segments are derived with the SAME shared `computeChapterSegments` the
   * headless layer and `playerstack-chapters` use (Req 1.6). Guards for the pre-render window.
   */
  private renderChapterSegments(): void {
    if (this.chaptersOverlay === null) {
      return;
    }
    // In ad mode the slider IS the ad progress bar: chapter markers are ignored entirely and no
    // segments render (parity with the original, which rendered the plain `adMode` track and no
    // ChapterSegments during an ad). Clear any prior segments + refs and hide the overlay.
    this.segments = this._adMode ? [] : computeChapterSegments(this.markers, this.duration);
    // Clear any previous dividers + refs before repainting.
    this.chaptersOverlay.textContent = '';
    this.segmentEls = [];
    this.hoveredIndex = -1;
    if (this.segments.length === 0 || this.duration <= 0) {
      this.chaptersOverlay.style.display = 'none';
      // No chapters: restore the plain rail/track as the timeline.
      this.removeAttribute('data-has-chapters');
      return;
    }
    this.chaptersOverlay.style.display = 'flex';
    // When chapters render, the segments ARE the timeline (the original hid the plain rail/track
    // entirely in the `hasChapters` branch). Flag the host so the Style_Layer hides the plain
    // `[part='track']` base, avoiding a translucent double-layer under the segments that made the
    // hovered segment look brighter/solid.
    this.setAttribute('data-has-chapters', 'true');
    for (const segment of this.segments) {
      const widthPercent = ((segment.endTime - segment.startTime) / this.duration) * 100;
      // Each block owns its buffered + played fill so it paints its OWN progress (parity with
      // the original StyledChapterSegment > Buffered + Filled).
      const block = document.createElement('div');
      block.setAttribute('part', 'chapter-segment');
      block.style.width = `${widthPercent}%`;
      block.title = segment.title;

      const buffered = document.createElement('div');
      buffered.setAttribute('part', 'chapter-segment-buffered');

      const hover = document.createElement('div');
      hover.setAttribute('part', 'chapter-segment-hover');

      const filled = document.createElement('div');
      filled.setAttribute('part', 'chapter-segment-filled');

      // Buffered sits behind hover, hover behind played fill (appended in order).
      block.appendChild(buffered);
      block.appendChild(hover);
      block.appendChild(filled);
      this.chaptersOverlay.appendChild(block);
      this.segmentEls.push({ block, buffered, hover, filled });
    }
    // Paint the initial per-segment fills from the current progress.
    this.updateFills();
  }

  /**
   * Marks the chapter segment under the hovered time with `data-hovered` so the Style_Layer
   * scales it up (`scaleY(2)` desktop / `scaleY(1.8)` fullscreen), matching the original
   * `hoveredIndex`. Resolves the index via the pre-computed segments (start-inclusive), clears
   * the previous marker and sets the new one; a no-op when there are no segments.
   */
  private updateHoveredSegment(time: number): void {
    if (this.segmentEls.length === 0) {
      return;
    }
    const chapter = getChapterAtTime(this.segments, time);
    const index = chapter === null ? -1 : this.segments.findIndex((s) => s.startTime === chapter.startTime);
    if (index === this.hoveredIndex) {
      return;
    }
    if (this.hoveredIndex >= 0) {
      this.segmentEls[this.hoveredIndex]?.block.removeAttribute('data-hovered');
    }
    if (index >= 0) {
      this.segmentEls[index]?.block.setAttribute('data-hovered', 'true');
    }
    this.hoveredIndex = index;
  }

  /** Clears any hovered-segment marker (pointer left the slider), resetting `hoveredIndex`. */
  private clearHoveredSegment(): void {
    if (this.hoveredIndex >= 0) {
      this.segmentEls[this.hoveredIndex]?.block.removeAttribute('data-hovered');
    }
    this.hoveredIndex = -1;
  }

  /** Clamps a fraction into `[0, 1]` so out-of-range store values never overflow the track. */
  private clampFraction(fraction: number): number {
    if (fraction < 0) return 0;
    if (fraction > 1) return 1;
    return fraction;
  }

  /**
   * Reflects the local `data-time-sliding` flag on the element host while the user scrubs
   * (Req 3.3). The original threaded a `timeSliding`/`isSliding` boolean into the slider so the
   * rail stayed thick, the handle popped and the tooltip stayed visible during a drag. The
   * controller already mirrors `data-time-sliding` from the store's `seeking`, but a local drag
   * has no store round-trip, so the element drives its OWN host attribute and the Style_Layer
   * keys off `playerstack-time-slider[data-time-sliding]` too. Kept agnostic: a plain host
   * attribute toggle, no adapter/store coupling.
   */
  private setSliding(sliding: boolean): void {
    if (sliding) {
      this.setAttribute('data-time-sliding', 'true');
    } else {
      this.removeAttribute('data-time-sliding');
    }
  }

  /**
   * Builds the Markup_Contract: a `part="time-slider"` container wrapping a `part="slider"`
   * region with `track` (holding `track-buffered` and `track-fill`) and `thumb`, plus a
   * `part="tooltip"` (TimeTooltip) and a `part="timelens"` thumbnail preview. Nodes are
   * created and APPENDED (never via `innerHTML`) so the adopted Style_Layer — in the fallback
   * path an injected `<style>` — is preserved. A guard keeps `render` idempotent across
   * reconnects.
   */
  protected render(): void {
    if (this.slider !== null) {
      return;
    }

    // Outer container: the state hook / positioning context for tooltip + timelens.
    const container = document.createElement('div');
    container.setAttribute('part', 'time-slider');

    const slider = document.createElement('div');
    slider.setAttribute('part', 'slider');
    // The slider region carries the configurable accessible name (Req 1.5).
    slider.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    const track = document.createElement('div');
    track.setAttribute('part', 'track');

    // Buffered fill sits behind the played fill: appended first so the played fill paints
    // over it in normal document order (Req 3.3).
    const trackBuffered = document.createElement('div');
    trackBuffered.setAttribute('part', 'track-buffered');

    const trackHover = document.createElement('div');
    trackHover.setAttribute('part', 'track-hover');

    const trackFill = document.createElement('div');
    trackFill.setAttribute('part', 'track-fill');

    // Chapter-segment dividers overlay the track and split the timeline into chapters
    // (ported from the original ChapterSegments). Empty + hidden until `chapters` is assigned.
    const chaptersOverlay = document.createElement('div');
    chaptersOverlay.setAttribute('part', 'chapters');
    chaptersOverlay.style.display = 'none';

    const thumb = document.createElement('div');
    thumb.setAttribute('part', 'thumb');

    track.appendChild(trackBuffered);
    track.appendChild(trackHover);
    track.appendChild(trackFill);
    slider.appendChild(track);
    // Chapter segments overlay the slider as a SIBLING of the track (NOT a child of it): the
    // track applies a `scaleY(0.6)` rest transform that would shrink the segments and cap their
    // hover-grow. The original ChapterSegmentsContainer was a sibling of the rail for the same
    // reason, so the hovered segment can grow to its full `scaleY(2)` height independently.
    slider.appendChild(chaptersOverlay);
    slider.appendChild(thumb);

    // Hover-time tooltip (StyledTooltip > StyledTip): a centered column that shows the hovered
    // TIME and, when chapters exist, the hovered chapter TITLE above it (StyledChapterLabel).
    // The timelens starts hidden until `spriteData` is provided and a hover computes a frame.
    const tooltip = document.createElement('div');
    tooltip.setAttribute('part', 'tooltip');

    // Chapter label renders ABOVE the time (matching the original StyledTip child order:
    // {chapterTitle && <StyledChapterLabel/>}{displayTime}). Empty + hidden until a hovered
    // chapter is resolved.
    const tooltipChapter = document.createElement('div');
    tooltipChapter.setAttribute('part', 'tooltip-chapter');
    tooltipChapter.style.display = 'none';

    const tooltipTime = document.createElement('div');
    tooltipTime.setAttribute('part', 'tooltip-time');

    tooltip.appendChild(tooltipChapter);
    tooltip.appendChild(tooltipTime);

    const timelens = document.createElement('div');
    timelens.setAttribute('part', 'timelens');
    timelens.style.display = 'none';

    // Heatmap ("most replayed") graph — lives INSIDE the slider container (parity with the
    // original HeatmapGraph) so it sits over the timeline, only shows on hover/scrub, and hides
    // with the controls. Base (dim) stroke + a bright played overlay clipped to the played
    // fraction. SVG nodes MUST be created in the SVG namespace to render.
    const heatmap = document.createElement('div');
    heatmap.setAttribute('part', 'heatmap');
    const heatmapSvg = document.createElementNS(SVG_NAMESPACE, 'svg');
    heatmapSvg.setAttribute('part', 'heatmap-svg');
    heatmapSvg.setAttribute('viewBox', HEATMAP_VIEW_BOX);
    heatmapSvg.setAttribute('preserveAspectRatio', 'none');
    const heatmapClipId = `playerstack-timeslider-heatmap-${(heatmapClipSeq += 1)}`;
    const heatmapDefs = document.createElementNS(SVG_NAMESPACE, 'defs');
    const heatmapClip = document.createElementNS(SVG_NAMESPACE, 'clipPath');
    heatmapClip.setAttribute('id', heatmapClipId);
    const heatmapClipRect = document.createElementNS(SVG_NAMESPACE, 'rect');
    heatmapClipRect.setAttribute('x', '0');
    heatmapClipRect.setAttribute('y', '0');
    heatmapClipRect.setAttribute('width', '0');
    heatmapClipRect.setAttribute('height', '100');
    heatmapClip.appendChild(heatmapClipRect);
    heatmapDefs.appendChild(heatmapClip);
    const heatmapPath = document.createElementNS(SVG_NAMESPACE, 'path');
    heatmapPath.setAttribute('part', 'heatmap-path');
    const heatmapPlayedPath = document.createElementNS(SVG_NAMESPACE, 'path');
    heatmapPlayedPath.setAttribute('part', 'heatmap-path-played');
    heatmapPlayedPath.setAttribute('clip-path', `url(#${heatmapClipId})`);
    heatmapSvg.appendChild(heatmapDefs);
    heatmapSvg.appendChild(heatmapPath);
    heatmapSvg.appendChild(heatmapPlayedPath);
    heatmap.appendChild(heatmapSvg);

    container.appendChild(slider);
    container.appendChild(heatmap);
    container.appendChild(tooltip);
    container.appendChild(timelens);

    // Pointer move over the slider positions the tooltip (and timelens when data is present)
    // at the hovered time computed with the SAME pure geometry as the headless layer (Req 1.6).
    // WHILE dragging (press-and-scrub), the move ALSO drives the optimistic played fill + thumb
    // to the pointer position, mirroring the original `onMouseMove` → `onChange(value)` loop.
    const onPointerMove = (event: PointerEvent): void => {
      // Ad mode: the timeline is a NON-interactive progress bar (the original disabled the
      // slider handle + cursor and never called `onChange` in `adMode`). No hover tooltip,
      // no chapter hover, no scrub — the ad position cannot be changed.
      if (this._adMode) {
        return;
      }
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }
      const time = getTimeFromSliderPosition(event.clientX, rect, this.duration);
      this.positionHover(event.clientX, rect, time);
      this.updateHoveredSegment(time);
      this.updateTrackHover(time);
      if (this.dragging) {
        this.dragMoved = true;
        this.dragTime = time;
        this.updateFills();
        // Broadcast the live scrub position so a skin can drive a full-area preview (e.g. the
        // mobile sprite preview) to the dragged time WITHOUT committing a seek on every move.
        this.dispatchRequest<ScrubbingRequestDetail>('playerstack-scrubbing-request', { seeking: true, time });
      }
    };
    slider.addEventListener('pointermove', onPointerMove);
    this.addDisposer(() => slider.removeEventListener('pointermove', onPointerMove));

    // Hide the hover affordances when the pointer leaves the slider — unless a drag is in
    // progress (the original kept the tooltip/handle visible while scrubbing off the track).
    const onPointerLeave = (): void => {
      if (this.dragging) {
        return;
      }
      tooltip.style.display = 'none';
      timelens.style.display = 'none';
      timelens.removeAttribute('data-visible');
      this.clearHoveredSegment();
      this.hideTrackHover();
    };
    slider.addEventListener('pointerleave', onPointerLeave);
    this.addDisposer(() => slider.removeEventListener('pointerleave', onPointerLeave));

    // Press-and-drag scrubbing (ported from `useTimeSlider.onMouseDown`): a pointer press
    // starts a drag, seeds the optimistic time from the press position, reflects
    // `data-time-sliding` on the host so the Style_Layer keeps the rail thick / handle popped /
    // tooltip visible while scrubbing, and captures the pointer so moves keep arriving even if
    // the pointer leaves the slider. NO request is emitted yet — the release commits the seek.
    const onPointerDown = (event: PointerEvent): void => {
      // Ad mode: seeking/scrubbing is disabled (parity with the original `adMode` slider), so a
      // press starts NO drag and emits NO seek — the ad cannot be fast-forwarded/rewound.
      if (this._adMode) {
        return;
      }
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }
      this.dragging = true;
      this.dragMoved = false;
      this.dragTime = getTimeFromSliderPosition(event.clientX, rect, this.duration);
      this.setSliding(true);
      // Capture the pointer (when supported) so the drag tracks past the slider bounds.
      if (typeof slider.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
        try {
          slider.setPointerCapture(event.pointerId);
        } catch {
          // Ignore: capture is a best-effort enhancement (jsdom lacks it).
        }
      }
      this.positionHover(event.clientX, rect, this.dragTime);
      this.updateFills();
      // Announce scrub start so the skin can show a full-area preview at the pressed position.
      this.dispatchRequest<ScrubbingRequestDetail>('playerstack-scrubbing-request', {
        seeking: true,
        time: this.dragTime,
      });
    };
    slider.addEventListener('pointerdown', onPointerDown);
    this.addDisposer(() => slider.removeEventListener('pointerdown', onPointerDown));

    // A pointer release commits the seek intent to the final pointer time (Req 2.1), reusing the
    // same pure geometry so the emitted time matches the tooltip/fill preview (Req 1.6). On a
    // plain click (no preceding drag) it seeks to the clicked time exactly as before; after a
    // drag it seeks to the release position and clears the sliding state.
    const onPointerUp = (event: PointerEvent): void => {
      // Ad mode: no click-to-seek — the ad position is fixed (parity with the original).
      if (this._adMode) {
        return;
      }
      const wasDragging = this.dragging;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        if (wasDragging) {
          this.dragging = false;
          this.setSliding(false);
          this.updateFills();
          // End the scrub even when the release rect is unusable so the preview hides.
          this.dispatchRequest<ScrubbingRequestDetail>('playerstack-scrubbing-request', {
            seeking: false,
            time: this.dragTime,
          });
        }
        return;
      }
      const time = getTimeFromSliderPosition(event.clientX, rect, this.duration);
      if (wasDragging) {
        this.dragging = false;
        this.setSliding(false);
        // Snap the optimistic fill to the release position until the store confirms the seek.
        this.dragTime = time;
        // End the scrub so the full-area preview hides as the seek commits.
        this.dispatchRequest<ScrubbingRequestDetail>('playerstack-scrubbing-request', { seeking: false, time });
      }
      this.dispatchRequest<SeekRequestDetail>('playerstack-seek-request', { time });
      // Auto-play after a drag release: the user scrubbed to a position and expects playback
      // to resume (YouTube behavior). Only fires after an actual drag, not a plain click-to-seek.
      if (wasDragging && this.dragMoved) {
        this.dispatchRequest('playerstack-play-request');
      }
      this.updateFills();
    };
    slider.addEventListener('pointerup', onPointerUp);
    this.addDisposer(() => slider.removeEventListener('pointerup', onPointerUp));
    // On disconnect, make sure any in-flight drag flag is cleared.
    this.addDisposer(() => {
      this.dragging = false;
    });

    this.slider = slider;
    this.trackFill = trackFill;
    this.trackBuffered = trackBuffered;
    this.trackHover = trackHover;
    this.thumb = thumb;
    this.chaptersOverlay = chaptersOverlay;
    this.tooltip = tooltip;
    this.tooltipTime = tooltipTime;
    this.tooltipChapter = tooltipChapter;
    this.timelens = timelens;
    this.heatmap = heatmap;
    this.heatmapPath = heatmapPath;
    this.heatmapPlayedPath = heatmapPlayedPath;
    this.heatmapClipRect = heatmapClipRect;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Seed duration/seek/loaded from any state the store already holds so the first paint uses
    // real progress (the context may resolve before render runs).
    const state = this.store?.getState();
    if (state !== undefined) {
      this.duration = state.duration;
      this.seek = state.seek;
      this.loaded = state.loaded;
      this.bufferedRanges = state.bufferedRanges || [];
    }

    // Apply any ad-mode gating set before connect (hide handle / default cursor), then paint the
    // initial fills + thumb and any chapter segments assigned before connect (a no-op in ad mode).
    this.applyAdMode();
    this.updateFills();
    this.renderChapterSegments();
    // Paint any heatmap data assigned before connect against the seeded duration/seek.
    this.updateHeatmap();
  }

  /**
   * Positions the hover tooltip at the pointer X and, when `spriteData` is present, computes
   * and applies the timelens frame geometry via `computeSpriteFrame` (Req 1.6). The tooltip
   * text uses the shared `formatTime` so it matches the rest of Core. Left as a small helper
   * so the pointer-move handler stays focused on reading the event.
   */
  private positionHover(clientX: number, rect: { left: number; width: number }, time: number): void {
    if (this.tooltip !== null) {
      const offsetX = clientX - rect.left;
      // StyledTooltip toggles display:block and is positioned at the pointer X; the inner
      // StyledTip centers on that point via translateX(-50%) in the Style_Layer.
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${offsetX}px`;
      if (this.tooltipTime !== null) {
        // In live-DVR mode the store feeds the seekable WINDOW (position as `seek`, window length
        // as `duration`), so the tooltip shows the NEGATIVE offset from the live edge (parity with
        // the original TimeTooltip live branch): `time - duration`, `0` within 1s of the edge.
        if (this._live && this.duration > 0) {
          const offset = time - this.duration;
          if (!isFinite(offset)) {
            this.tooltipTime.textContent = '';
          } else {
            this.tooltipTime.textContent = offset >= -1 ? formatTime(0) : formatLiveOffset(offset, false);
          }
        } else {
          this.tooltipTime.textContent = isFinite(time) ? formatTime(time) : '';
        }
      }
      // When chapters exist, surface the hovered chapter's TITLE above the time
      // (StyledChapterLabel), resolved with the SAME shared helper the headless layer uses.
      if (this.tooltipChapter !== null) {
        const chapter = this.segments.length > 0 ? getChapterAtTime(this.segments, time) : null;
        if (chapter !== null) {
          this.tooltipChapter.textContent = chapter.title;
          this.tooltipChapter.style.display = 'block';
        } else {
          this.tooltipChapter.textContent = '';
          this.tooltipChapter.style.display = 'none';
        }
      }
    }

    // Timelens is wired only when cues are available (from the adapter load or the direct
    // `spriteData` channel). NATIVE 1:1 render (parity with the original desktop Timelens): the
    // box is sized to the matched cue's own `w`/`h` and the sheet is offset by `-x`/`-y` — no
    // container measuring, no cover-scale, no `background-size` (Req 1.6).
    if (this.timelens === null || this.cues.length === 0) {
      return;
    }
    const frame = computeTimelensFrame(this.cues, time);
    if (frame === null) {
      this.timelens.style.display = 'none';
      this.timelens.removeAttribute('data-visible');
      return;
    }
    // Clamp the thumbnail so it stays within the slider track (parity with the original
    // `marginLeft` clamp): center it on the pointer, but never overflow the left/right edges.
    const pointerX = clientX - rect.left;
    const clampedLeft = Math.min(Math.max(0, pointerX - frame.w / 2), Math.max(0, rect.width - frame.w));
    this.timelens.style.display = 'block';
    // Toggle a `data-visible` hook so the Style_Layer fades the thumbnail in (parity with the
    // original `showing` opacity transition); `display` handles layout, opacity handles the fade.
    this.timelens.setAttribute('data-visible', 'true');
    this.timelens.style.width = `${frame.w}px`;
    this.timelens.style.height = `${frame.h}px`;
    this.timelens.style.left = `${clampedLeft}px`;
    this.timelens.style.backgroundImage = `url(${frame.file})`;
    this.timelens.style.backgroundSize = '';
    this.timelens.style.backgroundPosition = `${frame.bgPosX}px ${frame.bgPosY}px`;
  }
}
