/**
 * `playerstack-chapters` — renders the current chapter title for the active playback time
 * (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it only reflects state: it consumes the shared store and never
 * touches the media element or dispatches requests. The chapter markers are supplied by the
 * consumer/adapter through the `chapters` property (raw `title` + `startTime` markers). The
 * element derives the computed segments with the SAME pure `computeChapterSegments` helper the
 * rest of Core uses (Req 1.6), so the boundaries stay consistent with the headless layer and
 * the time slider's chapter rendering.
 *
 * On every store change it resolves the active chapter for the current seek via
 * `getChapterAtTime` (Req 1.6), writes its title into the `part="chapter-title"` region, and
 * reflects `data-active` on the host when a chapter is current so the Style_Layer can toggle
 * the display (Req 3.3). Segments depend on the total duration, so they are recomputed both
 * when the markers are assigned and when the store reports a new duration.
 */
import type { ChaptersInput } from '@typings/ui/playerstack-chapters.types';
import type { ChapterInput, ChapterSegment } from '@typings/chapters.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { computeChapterSegments, getChapterAtTime } from '@chapters';

export class PlayerstackChapters extends PlayerstackElement {
  /**
   * Raw chapter markers tracked from the assigned input. Empty until a consumer/adapter
   * supplies them via `chapters`; recomputed into `segments` whenever the markers or the
   * store duration change.
   */
  private markers: ChapterInput[] = [];

  /**
   * Computed chapter segments derived from `markers` + duration via `computeChapterSegments`
   * (Req 1.6). Reused across store updates so the active-chapter lookup runs against the
   * pre-computed segments.
   */
  private segments: ChapterSegment[] = [];

  /** Latest total duration (seconds) mirrored from the store; feeds segment computation. */
  private duration = 0;

  /** Latest seek position (seconds) mirrored from the store; selects the active chapter. */
  private seek = 0;

  /** The rendered chapters container; kept so `render` stays idempotent across reconnects. */
  private container: HTMLElement | null = null;

  /** The rendered chapter-title region; updated with the active chapter title on change. */
  private titleRegion: HTMLElement | null = null;

  /**
   * Public setter/property to supply the raw chapter markers. Assigning markers recomputes
   * the segments via the shared `computeChapterSegments` (Req 1.6) against the current
   * duration and repaints the active chapter immediately so the display reflects the new
   * markers without waiting for the next store update.
   */
  set chapters(input: ChaptersInput | null) {
    this.markers = input ?? [];
    this.recomputeSegments();
    this.updateActiveChapter();
  }

  get chapters(): ChaptersInput | null {
    return this.markers;
  }

  /**
   * Tracks the duration and seek this element cares about. A duration change recomputes the
   * segments (their boundaries depend on the total duration); the seek then selects the
   * active chapter. Only the fields needed are read, per the base class's opt-in
   * `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    if (state.duration !== this.duration) {
      this.duration = state.duration;
      this.recomputeSegments();
    }
    this.seek = state.seek;
    this.updateActiveChapter();
  }

  /**
   * Recomputes the chapter segments from the tracked markers + duration via the shared
   * `computeChapterSegments` (Req 1.6). Kept as a small helper so both the `chapters` setter
   * and the duration branch of `onStoreChange` derive segments the same way.
   */
  private recomputeSegments(): void {
    this.segments = computeChapterSegments(this.markers, this.duration);
  }

  /**
   * Resolves the active chapter for the current seek via the shared `getChapterAtTime`
   * (Req 1.6), writes its title into the `part="chapter-title"` region, and reflects
   * `data-active` on the host when a chapter is current (Req 3.3). Guards for the pre-render
   * window: if called before `render` created the region, the paint is skipped and `render`
   * repaints from the latest state on connect.
   */
  private updateActiveChapter(): void {
    if (this.titleRegion === null) {
      return;
    }
    const activeChapter = getChapterAtTime(this.segments, this.seek);
    this.titleRegion.textContent = activeChapter?.title ?? '';
    // Reflect whether a chapter is currently active so the Style_Layer can toggle the display.
    this.reflectState({ active: activeChapter !== null });
  }

  /**
   * Builds the Markup_Contract: a `part="chapters"` container holding a `part="chapter-title"`
   * region. Nodes are created and APPENDED (never via `innerHTML`) so the adopted Style_Layer
   * — in the fallback path an injected `<style>` — is preserved. A guard keeps `render`
   * idempotent across reconnects.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('part', 'chapters');

    const titleRegion = document.createElement('div');
    titleRegion.setAttribute('part', 'chapter-title');

    container.appendChild(titleRegion);

    this.container = container;
    this.titleRegion = titleRegion;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Recompute + paint from whatever state the store has already delivered (if the context
    // resolved before render ran) and from any markers assigned before connect.
    const state = this.store?.getState();
    if (state !== undefined) {
      this.duration = state.duration;
      this.seek = state.seek;
      this.recomputeSegments();
    }
    this.updateActiveChapter();
  }
}
