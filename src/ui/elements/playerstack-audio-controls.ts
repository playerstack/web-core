/**
 * `playerstack-audio-controls` — the compact single-row controls bar for AUDIO players
 * (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * This element reproduces the ORIGINAL audio skin's `StyledControlsRow` as ONE reusable Core
 * UI_Element (framework-agnostic, per the Core-vs-Skin rules): a single horizontal row holding
 * the transport cluster (skip-back ±10s, play/pause/replay, skip-forward ±10s), a content area
 * that morphs between a paused "Play:/Replay: title • chapter" label and the seek timeline, the
 * remaining-time read-out (`-M:SS`), and the seek timeline itself — either a single track or a
 * per-chapter segmented rail with buffered ranges, a played fill, an animated loading shimmer,
 * and a hover read-out (chapter + time). It NEVER touches the media element: every interaction
 * is expressed as a request event (`playerstack-play-request`/`-pause-request`/`-seek-request`,
 * plus `playerstack-ad-skip`/`-ad-click` in ad mode) that the MediaController / skin routes.
 *
 * All computation is delegated to Core's pure helpers so the audio bar stays consistent with
 * the rest of Core (Req 1.6): `getTimeFromSliderPosition` for seek geometry, `formatTime` for
 * the read-out, `computeChapterSegments`/`getChapterAtTime` for chapter boundaries + active
 * chapter, and `computeAdPlaybackState` for the ad skip timer / countdown / progress.
 *
 * State flows in through the shared store (playing, seek, duration, isEnded, isBuffering,
 * bufferedRanges); the rich `chapters`/`title`/`ads` inputs arrive through the property channel.
 * The element reflects `data-playing`/`data-ended`/`data-buffering`/`data-ad-active` on its host
 * so the Style_Layer reveals the skip buttons, morphs the label↔timeline, animates the loading
 * stripes and paints the ad-mode (yellow) timeline — mirroring the original `isPlaying`,
 * `waiting`, `ended` and `isAdActive` gates.
 *
 * Accessibility (Req 1.5): the play/pause `<button>` carries the implicit ARIA `button` role and
 * its accessible name is configurable via `aria-label` (English default when omitted); the skip
 * buttons carry their own descriptive labels.
 */
import type {
  AudioControlsDefaultLabel,
  AudioControlsPart,
  AudioControlsChapters,
  AudioControlsAds,
} from '@typings/ui/playerstack-audio-controls.types';
import type { SeekRequestDetail } from '@typings/ui/media-controller.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { ChapterInput, ChapterSegment } from '@typings/chapters.types';
import type { AudioPlayerState } from '@player-state';
import { PlayerstackElement } from '@ui/playerstack-element';
import { audioPlayerStateInitial } from '@player-state';
import { getTimeFromSliderPosition } from '@slider';
import { formatTime } from '@utils/format';
import { computeChapterSegments, getChapterAtTime } from '@chapters';
import { computeAdPlaybackState } from '@ads-controller';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import {
  audioPlayIcon,
  audioPauseIcon,
  audioReplayIcon,
  skipBackIcon,
  skipForwardIcon,
  skipAdIcon,
} from '@icons/index';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: AudioControlsDefaultLabel = 'Play';

/** Seconds skipped by the ±10s transport buttons (parity with the original `handleSkip*`). */
const SKIP_SECONDS = 10;

export class PlayerstackAudioControls extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the play/pause button's accessible name
   * is configurable via markup (Req 1.5). Keying the schema by `label` while mapping to the
   * `aria-label` attribute keeps the prop name readable and drives `observedAttributes`.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
    bufferMode: { attribute: 'buffer-mode', type: 'string' },
  } as const;

  /** Local snapshot of the AUDIO-relevant store state, seeded from the shared audio defaults. */
  private audioState: AudioPlayerState = { ...audioPlayerStateInitial };

  /** Latest buffered ranges mirrored from the store; painted as buffered rail pieces. */
  private bufferedRanges: Array<{ start: number; end: number }> = [];

  /** Raw chapter markers supplied via the `chapters` property; recomputed into `segments`. */
  private markers: ChapterInput[] = [];

  /** Computed chapter segments derived from `markers` + duration via `computeChapterSegments`. */
  private segments: ChapterSegment[] = [];

  /** Track title supplied via the `title` property; shown in the paused label. */
  private trackTitle = '';

  /** Ad config supplied via the `ads` property; drives ad-mode (skip button + countdown). */
  private adsConfig: AudioControlsAds = null;

  /** `true` once playback has started while ads are configured (pre-roll activation). */
  private adStarted = false;

  /** Rendered nodes kept so `render` stays idempotent and `onStoreChange` can repaint them. */
  private container: HTMLElement | null = null;
  private button: HTMLButtonElement | null = null;
  private iconPlay: HTMLElement | null = null;
  private iconPause: HTMLElement | null = null;
  private iconReplay: HTMLElement | null = null;
  private iconSkipAd: HTMLElement | null = null;
  private skipCountdownLabel: HTMLElement | null = null;
  private mediaLabel: HTMLElement | null = null;
  private timeSpan: HTMLSpanElement | null = null;
  private track: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private tooltipChapter: HTMLElement | null = null;
  private tooltipTime: HTMLElement | null = null;

  /** Persistent hover highlight element (sibling of track in slider, survives track repaint). */
  private trackHover: HTMLElement | null = null;

  /** Persistent thumb/knob element at the current played position (sibling of track in slider). */
  private thumb: HTMLElement | null = null;

  /** `true` while the user drags the seek bar (parity with the original document-drag). */
  private seeking = false;

  /**
   * Time (seconds) under the hovering pointer, or `-1` when the pointer is not over the
   * timeline. Drives WHICH chapter segment pops (scaleY) — the one under the MOUSE, exactly
   * like the original `hoveredSegmentIndex` (derived from `getChapterAtTime(tooltipTime)`), NOT
   * the segment currently playing.
   */
  private hoverTime = -1;

  // ─── Ad-mode helpers ──────────────────────────────────────

  /** Whether ads are configured and pre-roll has activated (mirrors `useAds.isAdActive`). */
  private get isAdActive(): boolean {
    return this.adsConfig !== null && this.adStarted;
  }

  /** Returns the active buffer visualization mode from the `buffer-mode` attribute. */
  private get bufferMode(): 'fragmented' | 'current' | 'classic' {
    const attr = this.getAttribute('buffer-mode');
    if (attr === 'classic') return 'classic';
    if (attr === 'current') return 'current';
    return 'fragmented';
  }

  // ─── Store wiring ─────────────────────────────────────────

  /**
   * Refreshes the local snapshot from the shared store, activates the pre-roll ad on first
   * play, reflects the host state attributes, and repaints the time text, timeline fill, label
   * and ad affordance. Only the audio-relevant fields are read (opt-in `onStoreChange`).
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    const wasPlaying = this.audioState.playing;

    this.audioState = {
      ...this.audioState,
      playing: state.playing,
      seek: state.seek,
      duration: state.duration,
      isEnded: state.isEnded,
      isBuffering: state.isBuffering || state.isLoading,
      volume: state.volume,
      isMuted: state.isMuted,
      loaded: state.loaded,
    };
    this.bufferedRanges = state.bufferedRanges ?? [];

    // Duration changed → recompute chapter boundaries.
    this.recomputeSegments();

    // Pre-roll activation: the ad only starts after the first transition into playing while
    // ads are configured (parity with `useAds`' paused→playing detection).
    if (this.adsConfig !== null && !this.adStarted && !wasPlaying && state.playing) {
      this.adStarted = true;
    }

    this.reflectHostState();
    this.updateButton();
    this.updateTime();
    this.paintTimeline();
    this.updateLabel();
  }

  /** Reflects the playback/ad flags the Style_Layer keys off (Req 3.3). */
  private reflectHostState(): void {
    const isPlaying = this.audioState.playing && !this.audioState.isEnded;
    this.reflectState({
      playing: isPlaying ? true : null,
      ended: this.audioState.isEnded ? true : null,
      buffering: this.audioState.isBuffering ? true : null,
      adActive: this.isAdActive ? true : null,
    });
  }

  // ─── Rich property setters (property channel) ─────────────

  /** Chapter markers → recompute segments and repaint the timeline/label. */
  set chapters(input: AudioControlsChapters) {
    this.markers = input ?? [];
    this.recomputeSegments();
    this.paintTimeline();
    this.updateLabel();
  }

  get chapters(): AudioControlsChapters {
    return this.markers;
  }

  /** Track title → repaint the paused label. */
  set title(value: string | null) {
    this.trackTitle = value ?? '';
    this.updateLabel();
  }

  get title(): string {
    return this.trackTitle;
  }

  /** Ad config → drive ad-mode; assigning null exits ad mode and resets activation. */
  set ads(value: AudioControlsAds) {
    this.adsConfig = value ?? null;
    if (this.adsConfig === null) {
      this.adStarted = false;
    } else if (this.audioState.playing && !this.audioState.isEnded) {
      // Auto-activate if ads appear while already playing (parity with `useAds`: "if ads
      // appears while `!paused && !ended` → adStarted = true").
      this.adStarted = true;
    }
    this.reflectHostState();
    this.updateButton();
    this.paintTimeline();
    this.updateLabel();
  }

  get ads(): AudioControlsAds {
    return this.adsConfig;
  }

  // ─── Pure derivations ─────────────────────────────────────

  private recomputeSegments(): void {
    this.segments = computeChapterSegments(this.markers, this.audioState.duration);
  }

  // ─── Painters ─────────────────────────────────────────────

  /**
   * Writes the REMAINING-time read-out (`-M:SS`) — parity with the original `StyledTime`
   * (`duration > 0 && remaining > 0 ? -formatTime(remaining) : '0:00'`).
   */
  private updateTime(): void {
    if (this.timeSpan === null) return;
    const { seek, duration } = this.audioState;
    const remaining = duration > 0 ? Math.max(0, duration - seek) : 0;
    this.timeSpan.textContent = duration > 0 && remaining > 0 ? `-${formatTime(remaining)}` : '0:00';
  }

  /**
   * Updates the label text: "Play:/Replay: title • activeChapter".
   *
   * Ad-aware title: while the pre-roll ad is ACTIVE (after the first play), the label shows the
   * ad's own title (`ads.title`) with NO chapter suffix — so the consumer can pass the ORIGINAL
   * track's `title`/`chapters` permanently and still surface the ad's info during the ad, without
   * swapping props by hand. In initial pause (ad NOT yet active) it shows the original `title`,
   * so on first load the full original-track info is visible until playback starts.
   */
  private updateLabel(): void {
    if (this.mediaLabel === null) return;
    // During an ad the prefix stays "Play:" (an ad is never a "Replay:", even on its ended
    // frame — the button skips to the original, it does not replay the ad).
    const prefix = this.audioState.isEnded && !this.isAdActive ? 'Replay: ' : 'Play: ';

    let labelText: string;
    if (this.isAdActive) {
      // During the ad (including its final ended frame, until the consumer swaps the source
      // back): the ad's title (falls back to the track title if the ad omits one). No chapter
      // suffix — the ad is not part of the original track's chapters.
      labelText = this.adsConfig?.title ?? this.trackTitle;
    } else {
      const active = getChapterAtTime(this.segments, this.audioState.seek);
      const chapterSuffix = active ? ` \u2022 ${active.title}` : '';
      labelText = `${this.trackTitle}${chapterSuffix}`;
    }

    // The prefix span is styled dimmer (`media-label-prefix`); the rest is plain text.
    this.mediaLabel.textContent = '';
    const prefixSpan = document.createElement('span');
    const prefixPart: AudioControlsPart = 'media-label-prefix';
    prefixSpan.setAttribute('part', prefixPart);
    prefixSpan.textContent = prefix;
    this.mediaLabel.appendChild(prefixSpan);
    this.mediaLabel.appendChild(document.createTextNode(labelText));
  }

  /** Swaps the transport button glyph and, in ad mode, the skip-ad affordance + countdown. */
  private updateButton(): void {
    if (this.button === null) return;

    // Ad mode → the play button is the skip-ad button.
    if (this.isAdActive) {
      // Ad has ENDED: force the skip-ad glyph, always clickable — it moves on to the original
      // content (the fallback when auto-resume did not run). Never show a "replay" glyph here.
      if (this.audioState.isEnded) {
        this.setGlyphVisibility({ skipAd: true });
        this.button.style.cursor = 'pointer';
        this.button.style.opacity = '1';
        this.button.setAttribute('aria-label', 'Skip ad');
        return;
      }
      const { hasSkipTimer, canSkip, skipCountdown } = computeAdPlaybackState({
        ads: this.adsConfig,
        currentTime: this.audioState.seek,
        duration: this.audioState.duration,
        isActive: true,
      });
      if (hasSkipTimer) {
        this.setGlyphVisibility({ skipAd: canSkip, countdown: !canSkip });
        if (this.skipCountdownLabel !== null) {
          this.skipCountdownLabel.textContent = `${skipCountdown}s`;
        }
        this.button.style.cursor = canSkip ? 'pointer' : 'default';
        this.button.style.opacity = canSkip ? '1' : '0.6';
        this.button.setAttribute('aria-label', canSkip ? 'Skip ad' : `${skipCountdown}s`);
        return;
      }
      // Ad without a skip timer, still running: show a plain (non-countdown) skip-ad glyph.
      this.setGlyphVisibility({ skipAd: true });
      this.button.style.cursor = 'pointer';
      this.button.style.opacity = '1';
      this.button.setAttribute('aria-label', 'Skip ad');
      return;
    }

    // Normal transport glyph: replay when ended, play when paused, pause when playing.
    this.button.style.cursor = 'pointer';
    this.button.style.opacity = '';
    if (this.audioState.isEnded) {
      this.setGlyphVisibility({ replay: true });
      this.button.setAttribute('aria-label', 'Replay');
    } else if (!this.audioState.playing) {
      this.setGlyphVisibility({ play: true });
      this.button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);
    } else {
      this.setGlyphVisibility({ pause: true });
      this.button.setAttribute('aria-label', 'Pause');
    }
  }

  /** Shows exactly one transport glyph; hides the rest. */
  private setGlyphVisibility(which: {
    play?: boolean;
    pause?: boolean;
    replay?: boolean;
    skipAd?: boolean;
    countdown?: boolean;
  }): void {
    const set = (el: HTMLElement | null, on: boolean | undefined): void => {
      if (el !== null) el.style.display = on ? '' : 'none';
    };
    set(this.iconPlay, which.play);
    set(this.iconPause, which.pause);
    set(this.iconReplay, which.replay);
    set(this.iconSkipAd, which.skipAd);
    set(this.skipCountdownLabel, which.countdown);
  }

  /**
   * Repaints the seek timeline: either the per-chapter segmented rail or a single track, each
   * with buffered ranges, a played fill and (while buffering) the animated loading stripes. Ad
   * mode paints the fill yellow (parity with the original `#fc0`). Built by clearing and
   * re-appending the rail children so the geometry always matches the current state.
   *
   * Buffer visualization is controlled by the `buffer-mode` attribute:
   * - 'fragmented' (default): show ALL buffered ranges individually.
   * - 'current': only show buffered ranges containing the current seek position (±0.5s tolerance).
   * - 'classic': show a single bar from 0 to the scalar `loaded` value.
   */
  private paintTimeline(): void {
    if (this.track === null) return;
    const { seek, duration, loaded } = this.audioState;
    this.track.textContent = '';
    if (duration <= 0) {
      // Even before metadata, show loading stripes when buffering/loading so the user sees
      // that data is being fetched (parity with the original StyledLoadingStripes on first load).
      if (this.audioState.isBuffering) {
        const stripes = document.createElement('div');
        const stripesPart: AudioControlsPart = 'loading-stripes';
        stripes.setAttribute('part', stripesPart);
        this.track.appendChild(stripes);
      }
      this.updateThumbPosition(0, 0);
      return;
    }

    const adFill = this.isAdActive ? '#fc0' : '';
    const buffering = this.audioState.isBuffering;
    const mode = this.bufferMode;

    // Resolve effective buffered ranges based on buffer-mode.
    const effectiveRanges = this.getEffectiveBufferedRanges(mode, seek, loaded, duration);

    if (this.segments.length > 0) {
      // Segmented (chapter) rail. The segment that POPS (scaleY) is the one under the hovering
      // pointer (`hoverTime`), not the one playing — parity with the original `hoveredSegmentIndex`.
      const hovered = this.hoverTime >= 0 ? getChapterAtTime(this.segments, this.hoverTime) : null;
      for (const seg of this.segments) {
        const segDuration = seg.endTime - seg.startTime;
        const widthPercent = (segDuration / duration) * 100;

        const segmentEl = document.createElement('div');
        const segPart: AudioControlsPart = 'chapter-segment';
        segmentEl.setAttribute('part', segPart);
        segmentEl.style.width = `${widthPercent}%`;
        if (hovered !== null && hovered.startTime === seg.startTime) {
          segmentEl.setAttribute('data-hovered', '');
        }

        // Buffered pieces intersecting this segment.
        let maxBufferedPct = 0;
        if (mode === 'classic') {
          // Classic: single fill from 0 to loaded fraction within this segment.
          const loadedTime = loaded * duration;
          if (loadedTime > seg.startTime) {
            const overlapEnd = Math.min(loadedTime, seg.endTime);
            const widthPct = ((overlapEnd - seg.startTime) / segDuration) * 100;
            maxBufferedPct = widthPct;
            const buf = document.createElement('div');
            const bufPart: AudioControlsPart = 'chapter-buffered';
            buf.setAttribute('part', bufPart);
            buf.style.left = '0%';
            buf.style.width = `${widthPct}%`;
            segmentEl.appendChild(buf);
          }
        } else {
          for (const range of effectiveRanges) {
            const overlapStart = Math.max(range.start, seg.startTime);
            const overlapEnd = Math.min(range.end, seg.endTime);
            if (overlapStart >= overlapEnd) continue;
            const leftPct = ((overlapStart - seg.startTime) / segDuration) * 100;
            const widthPct = ((overlapEnd - overlapStart) / segDuration) * 100;
            maxBufferedPct = Math.max(maxBufferedPct, leftPct + widthPct);
            const buf = document.createElement('div');
            const bufPart: AudioControlsPart = 'chapter-buffered';
            buf.setAttribute('part', bufPart);
            buf.style.left = `${leftPct}%`;
            buf.style.width = `${widthPct}%`;
            segmentEl.appendChild(buf);
          }
        }

        // Played fill for this segment.
        let fillPercent = 0;
        if (seek >= seg.endTime) fillPercent = 100;
        else if (seek > seg.startTime) fillPercent = ((seek - seg.startTime) / segDuration) * 100;
        const fill = document.createElement('div');
        const fillPart: AudioControlsPart = 'chapter-fill';
        fill.setAttribute('part', fillPart);
        fill.style.width = `${fillPercent}%`;
        if (adFill !== '') fill.style.background = adFill;
        segmentEl.appendChild(fill);

        // Hover highlight within this segment (YouTube-style seek preview, respects chapter gaps).
        if (this.hoverTime > seek && this.hoverTime > seg.startTime && seek < seg.endTime) {
          const hoverStart = Math.max(seek, seg.startTime);
          const hoverEnd = Math.min(this.hoverTime, seg.endTime);
          if (hoverEnd > hoverStart) {
            const hoverLeftPct = ((hoverStart - seg.startTime) / segDuration) * 100;
            const hoverWidthPct = ((hoverEnd - hoverStart) / segDuration) * 100;
            const hoverEl = document.createElement('div');
            const hoverPart: AudioControlsPart = 'chapter-hover';
            hoverEl.setAttribute('part', hoverPart);
            hoverEl.style.left = `${hoverLeftPct}%`;
            hoverEl.style.width = `${hoverWidthPct}%`;
            segmentEl.appendChild(hoverEl);
          }
        }

        if (buffering && maxBufferedPct < 100) {
          const stripes = document.createElement('div');
          const stripesPart: AudioControlsPart = 'loading-stripes';
          stripes.setAttribute('part', stripesPart);
          stripes.style.clipPath = `inset(0 0 0 ${Math.max(maxBufferedPct, fillPercent)}%)`;
          segmentEl.appendChild(stripes);
        }

        this.track.appendChild(segmentEl);
      }
      this.updateThumbPosition(seek, duration);
      return;
    }

    // Single-track rail.
    const progress = (seek / duration) * 100;
    let maxBufferedPct = 0;

    if (mode === 'classic') {
      // Classic: single bar from 0 to loaded fraction.
      const loadedPct = loaded * 100;
      if (loadedPct > 0) {
        maxBufferedPct = loadedPct;
        const buf = document.createElement('div');
        const bufPart: AudioControlsPart = 'track-buffered';
        buf.setAttribute('part', bufPart);
        buf.style.left = '0%';
        buf.style.width = `${loadedPct}%`;
        this.track.appendChild(buf);
      }
    } else if (effectiveRanges.length > 0) {
      for (const range of effectiveRanges) {
        const leftPct = (range.start / duration) * 100;
        const widthPct = ((range.end - range.start) / duration) * 100;
        maxBufferedPct = Math.max(maxBufferedPct, leftPct + widthPct);
        const buf = document.createElement('div');
        const bufPart: AudioControlsPart = 'track-buffered';
        buf.setAttribute('part', bufPart);
        buf.style.left = `${leftPct}%`;
        buf.style.width = `${widthPct}%`;
        this.track.appendChild(buf);
      }
    }

    const fill = document.createElement('div');
    const fillPart: AudioControlsPart = 'track-fill';
    fill.setAttribute('part', fillPart);
    fill.style.width = `${progress}%`;
    if (adFill !== '') fill.style.background = adFill;
    this.track.appendChild(fill);

    if (buffering && maxBufferedPct < 100) {
      const stripes = document.createElement('div');
      const stripesPart: AudioControlsPart = 'loading-stripes';
      stripes.setAttribute('part', stripesPart);
      stripes.style.clipPath = `inset(0 0 0 ${Math.max(maxBufferedPct, progress)}%)`;
      this.track.appendChild(stripes);
    }

    this.updateThumbPosition(seek, duration);
  }

  /**
   * Returns the effective buffered ranges based on the buffer-mode setting.
   * - 'fragmented': all ranges (current behavior).
   * - 'current': only ranges containing the current seek position (±0.5s tolerance).
   * - 'classic': not used (caller handles classic separately).
   */
  private getEffectiveBufferedRanges(
    mode: 'fragmented' | 'current' | 'classic',
    seek: number,
    _loaded: number,
    _duration: number,
  ): Array<{ start: number; end: number }> {
    if (mode === 'current') {
      return this.bufferedRanges.filter((range) => seek >= range.start - 0.5 && seek <= range.end + 0.5);
    }
    return this.bufferedRanges;
  }

  /** Updates the thumb knob position (percentage of played duration). Hidden during ads. */
  private updateThumbPosition(seek: number, duration: number): void {
    if (this.thumb === null) return;
    if (duration > 0) {
      const fraction = seek / duration;
      // The track sits inside the slider's 4px padding on each side. Map the thumb position
      // to the track's actual range so it never overflows past the track's rounded endpoints.
      // `calc(4px + fraction * (100% - 8px))` converts a 0–1 fraction to the track's left–right.
      this.thumb.style.left = `calc(4px + ${fraction * 100}% - ${fraction * 8}px)`;
    } else {
      this.thumb.style.left = '4px';
    }
    this.thumb.style.display = this.isAdActive ? 'none' : '';
  }

  // ─── Seek / hover geometry ────────────────────────────────

  /** Emits a seek request for the pointed time (reuses the shared slider geometry, Req 1.6). */
  private emitSeekAt(clientX: number): void {
    if (this.track === null) return;
    const rect = this.track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const time = getTimeFromSliderPosition(clientX, rect, this.audioState.duration);
    this.dispatchRequest<SeekRequestDetail>('playerstack-seek-request', { time });
  }

  /** Updates the hover read-out (chapter + time) anchored above the pointer, tracks the hovered
   * time and repaints so the hovered chapter segment pops (scaleY). */
  private updateHoverTooltip(clientX: number): void {
    if (this.track === null || this.tooltip === null) return;
    const rect = this.track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const time = getTimeFromSliderPosition(clientX, rect, this.audioState.duration);
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (this.tooltipTime !== null) this.tooltipTime.textContent = formatTime(time);
    const active = getChapterAtTime(this.segments, time);
    if (this.tooltipChapter !== null) {
      this.tooltipChapter.textContent = active?.title ?? '';
      // Hide the chapter line only when there is no chapter (single-track); with chapters it
      // always shows the hovered chapter's title (parity with the original tooltip).
      this.tooltipChapter.style.display = active ? '' : 'none';
    }
    this.tooltip.style.left = `${fraction * 100}%`;
    this.tooltip.setAttribute('data-visible', 'true');
    // Track hovered time and repaint so the segment under the mouse pops.
    if (this.hoverTime !== time) {
      this.hoverTime = time;
      this.paintTimeline();
    }
    this.updateTrackHover(clientX);
  }

  private hideHoverTooltip(): void {
    if (this.tooltip !== null) this.tooltip.setAttribute('data-visible', 'false');
    if (this.hoverTime !== -1) {
      this.hoverTime = -1;
      this.paintTimeline();
    }
    this.hideTrackHover();
  }

  /**
   * Updates the hover highlight bar (YouTube-style): shows a tinted fill from the current
   * played position to the pointer position. Only visible when hovering AHEAD of played.
   */
  private updateTrackHover(clientX: number): void {
    if (this.trackHover === null || this.track === null || this.audioState.duration <= 0) return;
    // When chapters exist, the per-segment chapter-hover divs handle this (painted in
    // paintTimeline), so hide the global track-hover and trigger a repaint instead.
    if (this.segments.length > 0) {
      this.trackHover.style.width = '0%';
      return;
    }
    const rect = this.track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const time = getTimeFromSliderPosition(clientX, rect, this.audioState.duration);
    const seek = this.audioState.seek;
    if (time <= seek) {
      this.trackHover.style.width = '0%';
      return;
    }
    const leftPct = (seek / this.audioState.duration) * 100;
    const widthPct = ((time - seek) / this.audioState.duration) * 100;
    this.trackHover.style.left = `${leftPct}%`;
    this.trackHover.style.width = `${widthPct}%`;
  }

  /** Hides the hover highlight bar when the pointer leaves the slider. */
  private hideTrackHover(): void {
    if (this.trackHover !== null) {
      this.trackHover.style.width = '0%';
    }
  }

  // ─── Render ───────────────────────────────────────────────

  /**
   * Builds the Markup_Contract as the single control row. Nodes are created and APPENDED (never
   * via `innerHTML`) so the adopted Style_Layer survives. A guard keeps `render` idempotent.
   */
  protected render(): void {
    if (this.container !== null) {
      return;
    }

    const containerPart: AudioControlsPart = 'audio-controls';
    const container = document.createElement('div');
    container.setAttribute('part', containerPart);

    container.appendChild(this.buildSkipButton('back'));
    container.appendChild(this.buildPlayButton());
    container.appendChild(this.buildSkipButton('forward'));
    container.appendChild(this.buildContentArea());
    container.appendChild(this.buildTimeReadout());

    this.container = container;
    this.root.appendChild(container);

    // Paint from whatever state the store already delivered (context may resolve before render).
    const state = this.store?.getState();
    if (state !== undefined) {
      this.onStoreChange(state);
    } else {
      this.updateButton();
      this.updateTime();
      this.updateLabel();
      this.paintTimeline();
    }
  }

  /** Builds a ±10s skip button emitting a seek request relative to the current position. */
  private buildSkipButton(direction: 'back' | 'forward'): HTMLButtonElement {
    const button = document.createElement('button');
    const part: AudioControlsPart = direction === 'back' ? 'skip-back-button' : 'skip-forward-button';
    button.setAttribute('part', part);
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', direction === 'back' ? 'Skip back' : 'Skip forward');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = renderSvgFromDescriptor(direction === 'back' ? skipBackIcon : skipForwardIcon);
    button.appendChild(icon);

    const onClick = (): void => {
      if (this.isAdActive || this.audioState.duration <= 0) return;
      const delta = direction === 'back' ? -SKIP_SECONDS : SKIP_SECONDS;
      const next = Math.max(0, Math.min(this.audioState.duration, this.audioState.seek + delta));
      this.dispatchRequest<SeekRequestDetail>('playerstack-seek-request', { time: next });
    };
    button.addEventListener('click', onClick);
    this.addDisposer(() => button.removeEventListener('click', onClick));
    return button;
  }

  /** Builds the play/pause/replay (and ad skip) button with all its swappable glyphs. */
  private buildPlayButton(): HTMLButtonElement {
    const buttonPart: AudioControlsPart = 'play-button';
    const button = document.createElement('button');
    button.setAttribute('part', buttonPart);
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    const makeGlyph = (descriptor: Parameters<typeof renderSvgFromDescriptor>[0]): HTMLElement => {
      const span = document.createElement('span');
      span.className = 'icon';
      span.innerHTML = renderSvgFromDescriptor(descriptor);
      span.style.display = 'none';
      button.appendChild(span);
      return span;
    };
    this.iconPlay = makeGlyph(audioPlayIcon);
    this.iconPause = makeGlyph(audioPauseIcon);
    this.iconReplay = makeGlyph(audioReplayIcon);
    this.iconSkipAd = makeGlyph(skipAdIcon);
    // The skip-ad glyph is rendered SMALLER than the other transport glyphs (the original used a
    // 24px icon inside the 36px button); tag it so the Style_Layer can size it down.
    this.iconSkipAd.classList.add('icon-skip-ad');

    // Skip-ad countdown label (shown before the ad becomes skippable).
    const countdown = document.createElement('span');
    countdown.className = 'skip-countdown';
    countdown.style.display = 'none';
    button.appendChild(countdown);
    this.skipCountdownLabel = countdown;

    const onClick = (): void => {
      // Ad mode: the button is the skip-ad affordance.
      if (this.isAdActive) {
        // Once the ad has ENDED, clicking ALWAYS skips it (the fallback to move on to the
        // original content if auto-resume did not run) — regardless of the skip timer.
        if (this.audioState.isEnded) {
          this.dispatchRequest('playerstack-ad-skip');
          return;
        }
        // While the ad is still running, skip only once it is skippable.
        const { canSkip } = computeAdPlaybackState({
          ads: this.adsConfig,
          currentTime: this.audioState.seek,
          duration: this.audioState.duration,
          isActive: true,
        });
        if (canSkip) this.dispatchRequest('playerstack-ad-skip');
        return;
      }
      // Normal transport: play when paused/ended, pause when playing.
      if (this.audioState.playing && !this.audioState.isEnded) {
        this.dispatchRequest('playerstack-pause-request');
      } else {
        this.dispatchRequest('playerstack-play-request');
      }
    };
    button.addEventListener('click', onClick);
    this.addDisposer(() => button.removeEventListener('click', onClick));

    this.button = button;
    return button;
  }

  /** Builds the content area: the paused label + the seek timeline sharing one cell. */
  private buildContentArea(): HTMLElement {
    const areaPart: AudioControlsPart = 'content-area';
    const area = document.createElement('div');
    area.setAttribute('part', areaPart);

    const labelPart: AudioControlsPart = 'media-label';
    const label = document.createElement('div');
    label.setAttribute('part', labelPart);
    this.mediaLabel = label;

    const wrapperPart: AudioControlsPart = 'timeline-wrapper';
    const wrapper = document.createElement('div');
    wrapper.setAttribute('part', wrapperPart);
    wrapper.appendChild(this.buildTimeline());

    area.appendChild(label);
    area.appendChild(wrapper);
    return area;
  }

  /** Builds the seek slider (track + hover tooltip) and wires click/drag/hover interactions. */
  private buildTimeline(): HTMLElement {
    const sliderPart: AudioControlsPart = 'slider';
    const slider = document.createElement('div');
    slider.setAttribute('part', sliderPart);

    const trackPart: AudioControlsPart = 'track';
    const track = document.createElement('div');
    track.setAttribute('part', trackPart);
    this.track = track;
    slider.appendChild(track);

    // Hover highlight (YouTube-style seek preview) — sibling of track so it survives repaint.
    const trackHover = document.createElement('div');
    const trackHoverPart: AudioControlsPart = 'track-hover';
    trackHover.setAttribute('part', trackHoverPart);
    slider.appendChild(trackHover);
    this.trackHover = trackHover;

    // Thumb/knob at the played position — sibling of track so it survives repaint.
    const thumb = document.createElement('div');
    const thumbPart: AudioControlsPart = 'thumb';
    thumb.setAttribute('part', thumbPart);
    slider.appendChild(thumb);
    this.thumb = thumb;

    // Hover read-out (chapter + time).
    const tooltipPart: AudioControlsPart = 'tooltip';
    const tooltip = document.createElement('div');
    tooltip.setAttribute('part', tooltipPart);
    tooltip.setAttribute('data-visible', 'false');
    const tChapter = document.createElement('span');
    const tChapterPart: AudioControlsPart = 'tooltip-chapter';
    tChapter.setAttribute('part', tChapterPart);
    const tTime = document.createElement('span');
    const tTimePart: AudioControlsPart = 'tooltip-time';
    tTime.setAttribute('part', tTimePart);
    tooltip.appendChild(tChapter);
    tooltip.appendChild(tTime);
    slider.appendChild(tooltip);
    this.tooltip = tooltip;
    this.tooltipChapter = tChapter;
    this.tooltipTime = tTime;

    // Press-and-drag seek (parity with the original document-level mouse/touch drag), disabled
    // during ads (the original set `pointer-events: none` on the ad timeline).
    const onPointerDown = (event: PointerEvent): void => {
      if (this.isAdActive || this.audioState.duration <= 0) return;
      this.seeking = true;
      this.reflectState({ seeking: true });
      this.emitSeekAt(event.clientX);
      if (typeof slider.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
        try {
          slider.setPointerCapture(event.pointerId);
        } catch {
          // Best-effort capture (jsdom lacks it).
        }
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (this.isAdActive) return;
      if (this.seeking) this.emitSeekAt(event.clientX);
      this.updateHoverTooltip(event.clientX);
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!this.seeking) return;
      this.seeking = false;
      this.reflectState({ seeking: null });
      this.emitSeekAt(event.clientX);
    };
    const onPointerLeave = (): void => {
      this.hideHoverTooltip();
    };
    slider.addEventListener('pointerdown', onPointerDown);
    slider.addEventListener('pointermove', onPointerMove);
    slider.addEventListener('pointerup', onPointerUp);
    slider.addEventListener('pointerleave', onPointerLeave);
    this.addDisposer(() => slider.removeEventListener('pointerdown', onPointerDown));
    this.addDisposer(() => slider.removeEventListener('pointermove', onPointerMove));
    this.addDisposer(() => slider.removeEventListener('pointerup', onPointerUp));
    this.addDisposer(() => slider.removeEventListener('pointerleave', onPointerLeave));
    this.addDisposer(() => {
      this.seeking = false;
    });
    return slider;
  }

  /** Builds the remaining-time read-out span. */
  private buildTimeReadout(): HTMLSpanElement {
    const timePart: AudioControlsPart = 'time';
    const time = document.createElement('span');
    time.setAttribute('part', timePart);
    time.textContent = '0:00';
    this.timeSpan = time;
    return time;
  }
}
