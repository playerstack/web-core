/**
 * `playerstack-play-time` — the current-time / duration read-out (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * As a display UI_Element it only reflects state: it consumes the shared store and never
 * touches the media element or dispatches requests. On every store change it writes the
 * current position into the `part="current-time"` span and the total duration into the
 * `part="duration"` span, both formatted with the SAME `formatTime` helper the rest of Core
 * uses (Req 1.6) so the displayed strings stay consistent (e.g. `01:23 / 04:56`).
 *
 * There is no configurable label to expose — the element renders plain formatted time text —
 * so it declares no observed attributes and keeps the Markup_Contract minimal. The `/`
 * separator is decorative, so it carries `aria-hidden` to avoid announcing punctuation.
 */
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { formatTime } from '@utils/format';
import { formatLiveOffset, stabilizeLiveOffset } from '@live-dvr';

export class PlayerstackPlayTime extends PlayerstackElement {
  /** The rendered current-time span; kept so `render` stays idempotent across reconnects. */
  private currentTimeSpan: HTMLSpanElement | null = null;

  /** The decorative `/` separator; hidden in live-DVR mode (no total duration to show). */
  private separatorSpan: HTMLSpanElement | null = null;

  /** The rendered duration span; kept so `onStoreChange` can update it after render. */
  private durationSpan: HTMLSpanElement | null = null;

  /** Latest store position/duration, retained so the `live` setter can repaint immediately. */
  private lastSeek = 0;
  private lastDuration = 0;

  /**
   * Last STABILIZED behind-live offset shown (0 = none/at-edge). The live window's `seekableEnd`
   * advances in segment steps while `currentTime` is smooth, so the raw offset jitters ±~1s while
   * playing the past at 1×; `stabilizeLiveOffset` holds this value unless the offset really moved,
   * keeping the readout steady (Option A / YouTube-style).
   */
  private _lastOffset = 0;

  /**
   * Live flag (default `false`) — the UNIFIED live flag (pure live OR live-DVR). When `true` the
   * read-out never shows the VOD `MM:SS / MM:SS`: on ANY live stream at the edge it shows NOTHING
   * (only the LIVE badge, like YouTube). The negative offset is shown ONLY additionally when
   * `liveDVR` is also set and the viewer is behind the edge (see `_liveDVR`).
   */
  private _live = false;

  /**
   * Live-DVR flag (default `false`). Distinguishes a time-shiftable live stream (has a seekable
   * DVR window) from a PURE live stream. Only in DVR mode does the store feed the WINDOW
   * (`seek` = position in window, `duration` = window length) so `seek - duration` is a valid
   * behind-live offset. In pure live there is no window, so the offset is meaningless and the
   * read-out stays hidden. Parity with the monolith, where `offsetDisplay` was passed ONLY in
   * live-DVR.
   */
  private _liveDVR = false;

  set live(value: boolean) {
    this._live = Boolean(value);
    this.paint();
  }

  get live(): boolean {
    return this._live;
  }

  set liveDVR(value: boolean) {
    this._liveDVR = Boolean(value);
    this.paint();
  }

  get liveDVR(): boolean {
    return this._liveDVR;
  }

  /**
   * Mirrors the current position and total duration from the store, then repaints the read-out
   * (Req 1.6). Guards for the pre-render window: if the store notifies before `render` created
   * the spans, `render` paints them from the latest store state on connect.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.lastSeek = state.seek;
    this.lastDuration = state.duration;
    this.paint();
  }

  /**
   * Paints the read-out from the retained store values + `live` flag. Behavior per mode:
   *   - Live AT THE EDGE: the read-out is EMPTY/hidden — no `00:00` next to the LIVE badge
   *     (parity with YouTube, which shows only "Live" while at the edge).
   *   - Live BEHIND the edge (playing the DVR past): shows the stabilized NEGATIVE offset
   *     (e.g. `-1:00`) and hides `/ duration`.
   *   - VOD/normal: the usual `MM:SS / MM:SS` read-out.
   */
  private paint(): void {
    if (this.currentTimeSpan === null) {
      return;
    }
    // Whether the current-time span is hidden (blank) in live mode.
    let hideCurrentTime = false;
    if (this._live) {
      // Behind-live offset ONLY makes sense in DVR (the store feeds the window there). In DVR,
      // show the stabilized negative offset while behind the edge; at the edge (or in PURE live,
      // which has no window) show NOTHING — only the LIVE badge, like YouTube.
      const rawOffset =
        this._liveDVR && this.lastDuration > 0 && isFinite(this.lastDuration) ? this.lastSeek - this.lastDuration : 0;
      if (this._liveDVR && rawOffset < -1) {
        // Stabilize against segment-step jitter so the readout doesn't flicker (-1:00 ↔ -1:01)
        // while the past plays at 1× (distance to live is effectively constant).
        const offset = stabilizeLiveOffset(rawOffset, this._lastOffset);
        this._lastOffset = offset;
        this.currentTimeSpan.textContent = formatLiveOffset(offset, false);
      } else {
        this._lastOffset = 0;
        this.currentTimeSpan.textContent = '';
        hideCurrentTime = true;
      }
    } else {
      this._lastOffset = 0;
      this.currentTimeSpan.textContent = formatTime(this.lastSeek);
    }
    this.currentTimeSpan.style.display = hideCurrentTime ? 'none' : '';
    // Hide the `/ duration` + separator when: live (no total), OR the duration is not known yet
    // (`<= 0`, metadata still loading). Showing `/ 00:00` on first load and then snapping to
    // `/ 10:29` is a jarring flash — instead show just the current time until the real duration
    // arrives, then reveal `/ MM:SS` (parity with players that defer the total until known).
    const hideDuration = this._live || this.lastDuration <= 0;
    if (this.durationSpan !== null) {
      this.durationSpan.textContent = formatTime(this.lastDuration);
      this.durationSpan.style.display = hideDuration ? 'none' : '';
    }
    if (this.separatorSpan !== null) {
      this.separatorSpan.style.display = hideDuration ? 'none' : '';
    }
  }

  /**
   * Builds the Markup_Contract: a `part="time"` container holding a `part="current-time"`
   * span, a decorative `/` separator, and a `part="duration"` span. Nodes are created and
   * APPENDED (never via `innerHTML`) so the adopted Style_Layer — in the fallback path an
   * injected `<style>` — is preserved. A guard keeps `render` idempotent across reconnects.
   */
  protected render(): void {
    if (this.currentTimeSpan !== null) {
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('part', 'time');

    const currentTime = document.createElement('span');
    currentTime.setAttribute('part', 'current-time');
    // Seed with a formatted zero so the read-out is well-formed before any store update.
    currentTime.textContent = formatTime(0);

    // Decorative separator: hidden from assistive tech so only the two times are announced.
    const separator = document.createElement('span');
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = ' / ';

    const duration = document.createElement('span');
    duration.setAttribute('part', 'duration');
    duration.textContent = formatTime(0);

    container.appendChild(currentTime);
    container.appendChild(separator);
    container.appendChild(duration);

    this.currentTimeSpan = currentTime;
    this.separatorSpan = separator;
    this.durationSpan = duration;

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(container);

    // Paint from whatever state the store has already delivered (if the context resolved
    // before render ran).
    const state = this.store?.getState();
    if (state !== undefined) {
      this.lastSeek = state.seek;
      this.lastDuration = state.duration;
    }
    this.paint();
  }
}
