/**
 * `playerstack-heatmap` — renders the "most replayed" heatmap graph as an inline SVG stroke
 * (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it only reflects state: it consumes the shared store (for the total
 * duration) and never touches the media element or dispatches requests. The heatmap data
 * points are supplied by the consumer/adapter through the `heatmapData` property. The element
 * derives the SVG stroke `d` with the SAME pure `generateHeatmapPath` helper the rest of Core
 * uses (Req 1.6), pairing the data points with the store's `duration`, so the curve stays
 * consistent with the headless layer and the React skin's HeatmapGraph.
 *
 * WHY the SVG is built with `createElementNS`: SVG elements live in the SVG namespace, so
 * `document.createElement('svg')` would produce an inert HTML-namespaced node. Using
 * `document.createElementNS('http://www.w3.org/2000/svg', ...)` yields a real, rendered SVG.
 * The `viewBox` is fixed at `0 0 100 100` because `generateHeatmapPath` emits coordinates in a
 * 0-100 space (x = percentage of duration, y = 100 - value*100).
 *
 * The path is recomputed both when the data points are assigned and when the store reports a
 * new duration (the x-coordinates depend on the total duration). When there is a non-empty
 * path, `data-active` is reflected on the host so the Style_Layer can toggle the graph
 * (Req 3.3).
 */
import type { HeatmapInput } from '@typings/ui/playerstack-heatmap.types';
import type { HeatmapDataPoint } from '@typings/heatmap.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { generateHeatmapPath } from '@heatmap';

/** SVG namespace URI required so `createElementNS` yields real, rendered SVG nodes. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Fixed viewBox matching the 0-100 coordinate space `generateHeatmapPath` emits. */
const HEATMAP_VIEW_BOX = '0 0 100 100';

export class PlayerstackHeatmap extends PlayerstackElement {
  /**
   * Heatmap data points tracked from the assigned input. Empty until a consumer/adapter
   * supplies them via `heatmapData`; paired with the store `duration` to compute the path.
   */
  private data: HeatmapDataPoint[] = [];

  /** Latest total duration (seconds) mirrored from the store; feeds the x-coordinate scale. */
  private duration = 0;

  /** Latest playback position (seconds) mirrored from the store; drives the played-overlay clip. */
  private seek = 0;

  /** The rendered heatmap container; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /** The rendered base `<path>` (dim stroke) that receives the generated `d` on every recompute. */
  private path: SVGPathElement | null = null;

  /** The rendered played `<path>` (bright stroke), clipped to the played fraction of the curve. */
  private playedPath: SVGPathElement | null = null;

  /** The `<rect>` inside the played clip whose width mirrors the played percentage (0-100). */
  private playedClipRect: SVGRectElement | null = null;

  /**
   * Public setter/property to supply the heatmap data points (matching what
   * `generateHeatmapPath` expects, Req 1.6). Assigning data recomputes the SVG path against
   * the current duration and repaints immediately so the graph reflects the new data without
   * waiting for the next store update.
   */
  set heatmapData(input: HeatmapInput | null) {
    this.data = input ?? [];
    this.updatePath();
  }

  get heatmapData(): HeatmapInput | null {
    return this.data;
  }

  /**
   * Tracks the total duration this element cares about; a duration change recomputes the path
   * because the x-coordinates scale by duration. Only the single field needed is read, per the
   * base class's opt-in `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    if (state.duration !== this.duration) {
      this.duration = state.duration;
      this.updatePath();
    }
    // Playback progress drives the bright played-overlay clip (parity with the original
    // HeatmapGraph "played portion brighter"); recompute the clip width when the position moves.
    if (state.seek !== this.seek) {
      this.seek = state.seek;
      this.updatePlayedClip();
    }
  }

  /**
   * Computes the SVG stroke `d` from the tracked data points + duration via the shared
   * `generateHeatmapPath` (Req 1.6), writes it onto the `<path>`, and reflects `data-active`
   * on the host when the path is non-empty (Req 3.3). Guards for the pre-render window: if
   * called before `render` created the path, the paint is skipped and `render` repaints from
   * the latest state on connect.
   */
  private updatePath(): void {
    if (this.path === null) {
      return;
    }
    const d = generateHeatmapPath(this.data, this.duration);
    this.path.setAttribute('d', d);
    // The bright played overlay traces the SAME curve; it is revealed progressively by the clip.
    if (this.playedPath !== null) {
      this.playedPath.setAttribute('d', d);
    }
    // Reflect whether there is a drawable curve so the Style_Layer can toggle the graph.
    this.reflectState({ active: d.length > 0 });
  }

  /**
   * Sizes the played-overlay clip `<rect>` to the played fraction of the curve (0-100 in the
   * SVG's 0-100 coordinate space), so the bright stroke reveals only up to the current position
   * (parity with the original HeatmapGraph `clipPath` rect width = `progressPercent`). Guarded
   * for the pre-render window and a zero/unknown duration.
   */
  private updatePlayedClip(): void {
    if (this.playedClipRect === null) {
      return;
    }
    const percent = this.duration > 0 ? Math.min(100, Math.max(0, (this.seek / this.duration) * 100)) : 0;
    this.playedClipRect.setAttribute('width', String(percent));
  }

  /**
   * Builds the Markup_Contract: a `part="heatmap"` container holding an inline
   * `part="heatmap-svg"` `<svg>` with a `part="heatmap-path"` `<path>`. The SVG nodes are
   * created in the SVG namespace via `createElementNS` and APPENDED (never via `innerHTML`) so
   * the adopted Style_Layer — in the fallback path an injected `<style>` — is preserved. A
   * guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('part', 'heatmap');

    // SVG elements MUST be created in the SVG namespace to render; the viewBox matches the
    // 0-100 coordinate space `generateHeatmapPath` produces.
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('part', 'heatmap-svg');
    svg.setAttribute('viewBox', HEATMAP_VIEW_BOX);
    // Preserve none so the curve stretches to whatever box the Style_Layer sizes.
    svg.setAttribute('preserveAspectRatio', 'none');

    // Base (dim) stroke: the full "most replayed" curve.
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('part', 'heatmap-path');

    // Played-overlay (bright) stroke: the SAME curve, revealed up to the played fraction via a
    // clip rect (parity with the original HeatmapGraph brighter played portion). A per-instance
    // clip id keeps multiple players on one page from colliding.
    const clipId = `playerstack-heatmap-played-${(PlayerstackHeatmap.clipSeq += 1)}`;
    const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
    const clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS(SVG_NAMESPACE, 'rect');
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('width', '0');
    clipRect.setAttribute('height', '100');
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    const playedPath = document.createElementNS(SVG_NAMESPACE, 'path');
    playedPath.setAttribute('part', 'heatmap-path-played');
    playedPath.setAttribute('clip-path', `url(#${clipId})`);

    svg.appendChild(defs);
    svg.appendChild(path);
    svg.appendChild(playedPath);
    container.appendChild(svg);

    this.container = container;
    this.path = path;
    this.playedPath = playedPath;
    this.playedClipRect = clipRect;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Recompute + paint from whatever duration the store has already delivered (if the context
    // resolved before render ran) and from any data assigned before connect.
    const state = this.store?.getState();
    if (state !== undefined) {
      this.duration = state.duration;
      this.seek = state.seek;
    }
    this.updatePath();
    this.updatePlayedClip();
  }

  /** Monotonic sequence for unique per-instance clip ids (multiple players on one page). */
  private static clipSeq = 0;
}
