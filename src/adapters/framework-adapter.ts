/**
 * Framework-agnostic adapter contract implementation (Req 8.1, 8.2, 8.3, 8.4).
 *
 * `domFrameworkAdapter` is the reference implementation of `FrameworkAdapterContract`
 * backed by pure DOM APIs. WHY it exists: every framework binding (React_Adapter, a
 * future Vue_Adapter, the Vanilla_Build) shares the SAME three primitives — reflect a
 * value as an attribute, assign a value as a property, and subscribe to a DOM event —
 * so centralizing them here means each framework builds on identical behaviour instead
 * of reimplementing attribute/property/event plumbing (Req 8.1, 8.2, 8.3).
 *
 * `UI_ELEMENT_BINDINGS` is the single source of truth describing every UI_Element: its
 * Custom Element tag, the attributes it observes, and the request events it dispatches
 * (Req 8.4). Framework adapters traverse this table to generate their per-element
 * wrappers so the full set of features is exposed uniformly across frameworks. Each
 * entry is derived directly from the corresponding element source: the `attributes`
 * come from each element's `static attributeSchema` (the concrete `.attribute` names it
 * observes), and the `requestEvents` come from the exact event strings each element
 * passes to `dispatchRequest`.
 */
import type { FrameworkAdapterContract, UiElementBinding } from '@typings/adapters/framework-adapter.types';

/**
 * Reference DOM-backed adapter shared by every framework binding (Req 8.1, 8.2, 8.3).
 * All three methods operate purely on the passed element with standard DOM APIs, so the
 * adapter is framework-agnostic and side-effect-free beyond the element it is handed.
 */
export const domFrameworkAdapter: FrameworkAdapterContract = {
  /**
   * Reflects a value onto the element as an HTML attribute (Req 8.2). A `null` value
   * removes the attribute; a boolean maps to attribute PRESENCE (`true` sets an empty
   * attribute, `false` removes it) matching how boolean HTML attributes work; any other
   * value is stringified and set. This mirrors the attribute semantics the UI_Elements
   * expect for their observed attributes.
   */
  syncAttribute(el, name, value): void {
    if (value === null) {
      el.removeAttribute(name);
      return;
    }
    if (typeof value === 'boolean') {
      if (value) {
        el.setAttribute(name, '');
      } else {
        el.removeAttribute(name);
      }
      return;
    }
    el.setAttribute(name, String(value));
  },

  /**
   * Assigns a value to the element as a JavaScript property (Req 8.2). Property setters
   * (e.g. `captionsSrc`, `chapters`, `spriteData`, `i18n`) are the channel for rich,
   * non-attribute inputs. A `Record` cast provides typed index access without resorting
   * to `any`, keeping the assignment type-safe while remaining generic.
   */
  syncProperty(el, name, value): void {
    (el as unknown as Record<string, unknown>)[name] = value;
  },

  /**
   * Subscribes to a DOM event on the element and returns an unsubscribe function
   * (Req 8.3). Framework adapters call the returned disposer on teardown so request
   * event listeners never leak, matching the deterministic cleanup the UI_Elements use.
   */
  subscribe(el, eventName, handler): () => void {
    el.addEventListener(eventName, handler);
    return () => el.removeEventListener(eventName, handler);
  },
};

/**
 * The complete UI_Element binding table: one entry per registered `playerstack-*`
 * element (Req 8.4). Kept in the same order as `PLAYERSTACK_ELEMENTS` so the two tables
 * stay easy to cross-check. Each `attributes` list is the set of concrete HTML attribute
 * names the element observes via its `static attributeSchema`, and each `requestEvents`
 * list is the exact set of event types the element passes to `dispatchRequest`.
 */
export const UI_ELEMENT_BINDINGS: readonly UiElementBinding[] = [
  // Root host: owns/provides the store and injects global tokens. `data-skin-mode` is declared
  // as an attribute so the React_Adapter REFLECTS it to the DOM (not as a JS property) — the
  // Style_Layer's mobile/desktop rules key off `playerstack-media-controller[data-skin-mode=…]`,
  // so it must be a real attribute. `data-skin` (audio) is reflected for the same reason.
  {
    tagName: 'playerstack-media-controller',
    attributes: ['data-skin-mode', 'data-skin'],
    requestEvents: [],
  },
  // Play/pause toggle: `aria-label` accessible name; emits play/pause intent.
  {
    tagName: 'playerstack-play-button',
    attributes: ['aria-label'],
    requestEvents: ['playerstack-play-request', 'playerstack-pause-request'],
  },
  // Mute toggle + volume slider: `aria-label` accessible name; `fill-origin` (`start` default,
  // `end` = full volume at the left / inverted pointer — audio design); emits mute/unmute/volume.
  {
    tagName: 'playerstack-volume',
    attributes: ['aria-label', 'fill-origin', 'orientation'],
    requestEvents: ['playerstack-mute-request', 'playerstack-unmute-request', 'playerstack-volume-request'],
  },
  // Progress slider: `aria-label` plus the optional `sprite-vtt-file` timelens hint;
  // emits seek intent.
  {
    tagName: 'playerstack-time-slider',
    attributes: ['aria-label', 'sprite-vtt-file', 'buffer-mode'],
    requestEvents: ['playerstack-seek-request', 'playerstack-scrubbing-request', 'playerstack-play-request'],
  },
  // Current-time / duration read-out: display-only, no attributes, no requests.
  {
    tagName: 'playerstack-play-time',
    attributes: [],
    requestEvents: [],
  },
  // Settings (speed + quality + captions): `aria-label` accessible name; emits rate + custom
  // quality, plus caption-language selection (`playerstack-caption-request`) and caption-STYLE
  // changes (`playerstack-caption-style-request`) from the desktop captions category + "Options"
  // style panel (parity with the original desktop settings + `CaptionOptions`). Rich props
  // (`qualityOptions`/`captions`/`activeCaption`/`captionStyle`/`i18n`/`adMode`) go via property.
  {
    tagName: 'playerstack-settings',
    attributes: ['aria-label'],
    requestEvents: [
      'playerstack-rate-request',
      'playerstack-quality-request',
      'playerstack-caption-request',
      'playerstack-caption-style-request',
    ],
  },
  // Fullscreen toggle: `aria-label` accessible name; emits enter/exit fullscreen.
  {
    tagName: 'playerstack-fullscreen-button',
    attributes: ['aria-label'],
    requestEvents: ['playerstack-enter-fullscreen-request', 'playerstack-exit-fullscreen-request'],
  },
  // Picture-in-Picture toggle: `aria-label` accessible name; emits enter/exit PiP.
  {
    tagName: 'playerstack-pip-button',
    attributes: ['aria-label'],
    requestEvents: ['playerstack-enter-pip-request', 'playerstack-exit-pip-request'],
  },
  // Caption overlay: display-only cue painting (source supplied via property); additionally
  // emits an external caption-track selection request via `selectCaption` (Req 21.1), which
  // the React_Adapter exposes as `onCaptionRequest` (mirrors the reactjs `onCaptionChange`).
  {
    tagName: 'playerstack-captions',
    attributes: [],
    requestEvents: ['playerstack-caption-request'],
  },
  // Chapter title: display-only (markers supplied via property), no attributes/requests.
  {
    tagName: 'playerstack-chapters',
    attributes: [],
    requestEvents: [],
  },
  // Heatmap graph: display-only (data supplied via property), no attributes/requests.
  {
    tagName: 'playerstack-heatmap',
    attributes: [],
    requestEvents: [],
  },
  // Right-click menu: no observed attributes; emits loop + enter/exit PiP intents (parity: the
  // original menu offered only Loop + Picture in Picture, no Fullscreen row). Gating props
  // (`adMode`/`live`/`pipEnabled`/`i18n`) are set through the property channel.
  {
    tagName: 'playerstack-context-menu',
    attributes: [],
    requestEvents: ['playerstack-loop-request', 'playerstack-enter-pip-request', 'playerstack-exit-pip-request'],
  },
  // Mobile settings panel: full-surface quality/speed/captions panel. Rich props
  // (`qualityOptions`/`captions`/`i18n`/`adMode`) are set through the property channel; it emits
  // rate/quality/caption intents on selection.
  {
    tagName: 'playerstack-mobile-settings',
    attributes: [],
    requestEvents: ['playerstack-rate-request', 'playerstack-quality-request', 'playerstack-caption-request'],
  },
  // Loading/buffering overlay: display-only, no attributes, no requests.
  {
    tagName: 'playerstack-spinner',
    attributes: [],
    requestEvents: [],
  },
  // Center play-state overlay: `aria-label` accessible name; emits play/pause intent.
  {
    tagName: 'playerstack-play-state',
    attributes: ['aria-label'],
    requestEvents: ['playerstack-play-request', 'playerstack-pause-request'],
  },
  // Top status message: `language` selects the localized message; display-only.
  {
    tagName: 'playerstack-top-state',
    attributes: ['language'],
    requestEvents: [],
  },
  // Blocked-playback tip: `language` selects the localized tip; a click on the tip / its
  // full-stage catcher (click-to-unmute case) emits a resume/unmute intent. The visibility
  // inputs (`hasResource`/`prevented`/`paused`/`muted`/`currentTime`) go via the property channel.
  {
    tagName: 'playerstack-prevented-tip',
    attributes: ['language'],
    requestEvents: ['playerstack-prevented-click'],
  },
  // Compact audio controls bar: `aria-label` accessible name; emits play/pause + seek (the
  // skip ±10s buttons and timeline all express seek intent), plus the ad-mode skip/click intents
  // when it renders the skip-ad affordance. Rich inputs (`chapters`/`title`/`ads`) arrive via the
  // property channel (they are not attributes), so they are not listed here.
  {
    tagName: 'playerstack-audio-controls',
    attributes: ['aria-label', 'buffer-mode'],
    requestEvents: [
      'playerstack-play-request',
      'playerstack-pause-request',
      'playerstack-seek-request',
      'playerstack-ad-skip',
      'playerstack-ad-click',
    ],
  },
  // Ad overlay: `aria-label` on the skip button; `language` localizes the banner "Sponsored"
  // label; emits ad-skip + ad-click.
  {
    tagName: 'playerstack-ad-overlay',
    attributes: ['aria-label', 'language'],
    requestEvents: ['playerstack-ad-skip', 'playerstack-ad-click'],
  },
  // LIVE indicator: `language` localizes the "Live" label; a click behind live emits a seek-to-edge.
  {
    tagName: 'playerstack-live-indicator',
    attributes: ['language'],
    requestEvents: ['playerstack-seek-request'],
  },
  // Double-tap skip overlay: `language` localizes the "seconds" label; a double tap emits a seek.
  {
    tagName: 'playerstack-double-tap',
    attributes: ['language'],
    requestEvents: ['playerstack-seek-request'],
  },
  // Icon renderer: `width`/`height` size the SVG; presentational, no requests.
  {
    tagName: 'playerstack-icon',
    attributes: ['width', 'height'],
    requestEvents: [],
  },
  // Prev/next navigation cluster: `prev-label`/`next-label` set each button's accessible
  // name; emits previous/next intent (Req 21.1) mirroring the reactjs `showNavButtons`.
  {
    tagName: 'playerstack-nav-buttons',
    attributes: ['prev-label', 'next-label'],
    requestEvents: ['playerstack-prev-request', 'playerstack-next-request'],
  },
  // Sprite/thumbnail preview: display-only. Rich props (`adapter`/`spriteVttFile`/`duration`/
  // `seekTime`/`visible`) go via the property channel; no attributes, no request events.
  {
    tagName: 'playerstack-sprite-preview',
    attributes: [],
    requestEvents: [],
  },
  // Live-stream ad break overlay: `language` localizes the AD / Live Stream / Skip labels. Rich
  // props (`adapter`, `trigger`) go via the property channel. Skip/CTA/complete are handled by
  // the owned LiveAdController through the ad config callbacks, so there are no request events.
  {
    tagName: 'playerstack-live-ad',
    attributes: ['language'],
    requestEvents: [],
  },
  // Media title read-out: `title` sets the displayed text; display-only, no request events.
  {
    tagName: 'playerstack-title',
    attributes: ['title'],
    requestEvents: [],
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Composable-player-components catalog (framework-agnostic, React-free — A1).
 *
 * WHY it lives here: this is the single source of truth for the composable public
 * surface every skin (reactjs, vue, solid, angular) inherits — exactly like
 * `UI_ELEMENT_BINDINGS` above (A6). Keeping the part catalog and its canonical order
 * as pure data + pure functions here stops each skin from duplicating them (A7). No
 * React, no DOM, no `document`/`navigator`/`window`, no timers (A1, Req 3.2/11.1/11.2).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Layout region a composable slot lives in (agnostic ordering contract). */
export type SlotRegion =
  | 'container' // the Player root
  | 'stage-overlay' // overlays above the video (poster, play-state, captions, …)
  | 'control-bar' // the control bar itself
  | 'control-bar-left' // left cluster of the control bar (within BottomBar)
  | 'control-bar-right' // right cluster of the control bar (within BottomBar)
  | 'timeline'; // the progress bar

/** Agnostic descriptor of one public composable part. */
export interface ComposableSlot {
  /** Public composable name (e.g. 'PlayButton', 'Volume', 'BottomBar'). */
  readonly name: string;
  /**
   * `playerstack-*` tag backing the part, or `null` when the part is a container
   * (`Player`/`BottomBar`/`TopBar`/`SidebarLeft`/`SidebarRight`/`DesktopUI`/`MobileUI`/
   * `CenterControls`), an engine-only input
   * (`Source`), or a skin-owned `<button>`/overlay not yet promoted to a Custom Element
   * (`Poster`, `CaptionsToggle`, `Cast`). Every non-null tag MUST already exist in
   * `UI_ELEMENT_BINDINGS` above (Req 3.4).
   */
  readonly element: string | null;
  /** Layout region. */
  readonly region: SlotRegion;
  /** Canonical order index across the catalog (smaller = earlier); unique per region. */
  readonly order: number;
  /**
   * Whether the part groups other slots — containers: `Player`, `BottomBar`, `TopBar`,
   * `SidebarLeft`, `SidebarRight`, plus the per-mode wrappers `DesktopUI`/`MobileUI` and the
   * mobile-only `CenterControls` (Req 3.7 / Req 15.1/15.2).
   */
  readonly container?: boolean;
  /** Whether the part belongs to the VIDEO default composition (see `DEFAULT_COMPOSITION`). */
  readonly inDefault: boolean;
  /**
   * Whether the part belongs to the AUDIO default composition (see `AUDIO_DEFAULT_COMPOSITION`).
   * The audio skin renders a different default control set than video (audio has no
   * Player/Poster/Timeline/Fullscreen/Cast and shows Title/Chapters by default), so it needs its
   * own default flag rather than reusing `inDefault` (which is video-specific). Absent = not part
   * of the audio default. Kept here so the audio default stays derived from the single catalog
   * (A7), exactly like the video `inDefault` flag.
   */
  readonly inDefaultAudio?: boolean;
  /**
   * Container-placement restriction (Req 16). When present, this slot is ONLY valid as a direct
   * child of one of the listed containers; placing it inside any other container (or at the
   * shared/top level) is an authoring error. Timeline-bound parts (`Timeline`, `Chapters`,
   * `Heatmap`) ride on the bottom-bar progress slider, so they are restricted to `BottomBar`.
   * Absent = the slot may live in any container. Kept here (agnostic catalog) so every skin
   * enforces the SAME rule from one source of truth (A6/A7).
   */
  readonly allowedContainers?: readonly string[];
}

/**
 * Agnostic catalog of composable parts. Every skin derives its public surface and its
 * canonical DOM order from this table (A7). Each non-null `element` references a tag that
 * already exists in `UI_ELEMENT_BINDINGS` (Req 3.4); `container: true` is set on root
 * (`Player`), on the four positionable control containers (`BottomBar`, `TopBar`,
 * `SidebarLeft`, `SidebarRight`), on the per-mode wrappers (`DesktopUI`, `MobileUI`) and on the
 * mobile-only `CenterControls` (Req 3.7 / Req 15.1/15.2); `order` is unique within each region.
 */
export const COMPOSABLE_SLOTS: readonly ComposableSlot[] = [
  {
    name: 'Player',
    element: 'playerstack-media-controller',
    region: 'container',
    order: 0,
    container: true,
    inDefault: true,
  },
  // `Source` only feeds the media engine (sources/fullHDQualityBreak) — it renders no UI (element: null).
  { name: 'Source', element: null, region: 'container', order: 5, inDefault: false },
  // Per-mode composition wrappers (Req 15). `DesktopUI`/`MobileUI` are root-level containers (like
  // `Player`) that hold their own container subtree; each layout consumes ONLY its own branch. They
  // render no UI themselves (element: null) and are opt-in (inDefault: false).
  { name: 'DesktopUI', element: null, region: 'container', order: 32, container: true, inDefault: false },
  { name: 'MobileUI', element: null, region: 'container', order: 33, container: true, inDefault: false },
  { name: 'PlayOverlay', element: 'playerstack-play-state', region: 'stage-overlay', order: 10, inDefault: true },
  // `Poster` is a skin-owned `.playerstack-poster` div, not a Custom Element (element: null).
  { name: 'Poster', element: null, region: 'stage-overlay', order: 20, inDefault: true },
  { name: 'Captions', element: 'playerstack-captions', region: 'stage-overlay', order: 30, inDefault: true },
  // Positionable control containers. `BottomBar` replaces the former `ControlBar` and is the
  // default bottom bar; `TopBar`, `SidebarLeft`, `SidebarRight` are opt-in containers for
  // placing controls at other edges of the player.
  { name: 'TopBar', element: null, region: 'control-bar', order: 35, container: true, inDefault: false },
  { name: 'SidebarLeft', element: null, region: 'control-bar', order: 36, container: true, inDefault: false },
  { name: 'SidebarRight', element: null, region: 'control-bar', order: 37, container: true, inDefault: false },
  // `CenterControls` is a mobile-only control container (prev·play·next centered over the video);
  // desktop has no equivalent. It groups controls like `BottomBar`/`TopBar` (Req 15.2).
  { name: 'CenterControls', element: null, region: 'control-bar', order: 38, container: true, inDefault: false },
  { name: 'BottomBar', element: null, region: 'control-bar', order: 40, container: true, inDefault: true },
  { name: 'PrevButton', element: null, region: 'control-bar-left', order: 50, inDefault: false },
  { name: 'NextButton', element: null, region: 'control-bar-left', order: 65, inDefault: false },
  // `PlayButton`/`Volume` are shared by name across skins (A7). Both are in the video default AND
  // the audio default, so they carry both flags. In audio, `PlayButton` renders inside the single
  // `playerstack-audio-controls` (marker gating), while `Volume` maps to its own `playerstack-volume`.
  {
    name: 'PlayButton',
    element: 'playerstack-play-button',
    region: 'control-bar-left',
    order: 60,
    inDefault: true,
    inDefaultAudio: true,
  },
  {
    name: 'Volume',
    element: 'playerstack-volume',
    region: 'control-bar-left',
    order: 70,
    inDefault: true,
    inDefaultAudio: true,
  },
  { name: 'PlayTime', element: 'playerstack-play-time', region: 'control-bar-left', order: 80, inDefault: true },
  // `Title` maps to `playerstack-title`, the Custom Element added in task 9.1 (A2). Its binding
  // now exists in `UI_ELEMENT_BINDINGS` above, so `element` is the bound tag (Req 3.4: a non-null
  // tag MUST already be bound). It stays out of the default composition (`inDefault: false`).
  // `Title` stays OUT of the video default (`inDefault: false`) but IS in the audio default
  // (`inDefaultAudio: true`): the audio-controls bar shows the title read-out by default. In audio
  // it is a presence marker gating the title inside `playerstack-audio-controls`, so its catalog
  // `element` (`playerstack-title`, the video tag) is not the audio DOM node — the audio layout
  // gates by presence, not by this element.
  {
    name: 'Title',
    element: 'playerstack-title',
    region: 'control-bar-left',
    order: 90,
    inDefault: false,
    inDefaultAudio: true,
  },
  // Timeline + its riders (Chapters/Heatmap) render on the bottom-bar progress slider, so they
  // are ONLY valid inside `BottomBar` (Req 16). Placing them in `TopBar`/`SidebarLeft`/
  // `SidebarRight`/`CenterControls` throws at resolve time and is a TS error in the editor.
  {
    name: 'Timeline',
    element: 'playerstack-time-slider',
    region: 'timeline',
    order: 100,
    inDefault: true,
    allowedContainers: ['BottomBar'],
  },
  // `Chapters`/`Heatmap` are timeline RIDERS: their content (`chapters`/`heatmapData`) paints on
  // the bottom-bar progress slider, so they share Timeline's `BottomBar`-only restriction (Req 16).
  // They are opt-in (`inDefault: false`) and never render standalone UI outside the slider.
  {
    name: 'Chapters',
    element: 'playerstack-chapters',
    region: 'timeline',
    order: 101,
    inDefault: false,
    // In audio, `Chapters` is the read-out INSIDE `playerstack-audio-controls` (not a timeline
    // rider — audio has no timeline/BottomBar), so it belongs to the audio default. The
    // `allowedContainers` restriction below is a VIDEO concern (timeline riders must live in
    // `BottomBar`); the audio skin never uses BottomBar/`validateSlotPlacement`, so the restriction
    // is inert for audio and does not affect the audio default membership.
    inDefaultAudio: true,
    allowedContainers: ['BottomBar'],
  },
  {
    name: 'Heatmap',
    element: 'playerstack-heatmap',
    region: 'timeline',
    order: 102,
    inDefault: false,
    allowedContainers: ['BottomBar'],
  },
  // `CaptionsToggle` is a skin-owned `<button>` (A2 promotion candidate: playerstack-captions-toggle).
  { name: 'CaptionsToggle', element: null, region: 'control-bar-right', order: 110, inDefault: true },
  // `Settings` is shared by name (A7) and is in BOTH defaults (speed menu + adMode in audio).
  {
    name: 'Settings',
    element: 'playerstack-settings',
    region: 'control-bar-right',
    order: 120,
    inDefault: true,
    inDefaultAudio: true,
  },
  // `Cast` is a skin-owned `<button>` (A2 promotion candidate: playerstack-cast-button).
  { name: 'Cast', element: null, region: 'control-bar-right', order: 130, inDefault: true },
  {
    name: 'Fullscreen',
    element: 'playerstack-fullscreen-button',
    region: 'control-bar-right',
    order: 140,
    inDefault: true,
  },
  // ── Audio-only parts (Req 3.6/3.7) ──────────────────────────────────────────────────────────
  // `AudioControls` maps to the ONE `playerstack-audio-controls` element (already bound in
  // `UI_ELEMENT_BINDINGS`, Req 3.4) that hosts play/pause, skip, title, chapters read-out and the
  // ad affordance for the audio skin. It is not a container (`container: false`): play/pause, skip,
  // title and chapters are presence MARKERS that gate what this single element shows, not nested
  // slots. Orders 200/205/215 sit far above every video index (≤140) so they never collide within
  // their region (Req 3.7). All three belong to the audio default (`inDefaultAudio: true`).
  {
    name: 'AudioControls',
    element: 'playerstack-audio-controls',
    region: 'control-bar',
    order: 200,
    container: false,
    inDefault: false,
    inDefaultAudio: true,
  },
  // `SkipBack`/`SkipForward` are audio-exclusive presence markers (skip ∓10s inside
  // `playerstack-audio-controls`), so they render no element of their own (`element: null`).
  { name: 'SkipBack', element: null, region: 'control-bar-left', order: 205, inDefault: false, inDefaultAudio: true },
  {
    name: 'SkipForward',
    element: null,
    region: 'control-bar-left',
    order: 215,
    inDefault: false,
    inDefaultAudio: true,
  },
];

/**
 * Default composition: the parts rendered when `<Player>` receives no children — a DX
 * convenience of the composed API (a bare `<Player url=… />` shows a sensible control set),
 * NOT a compatibility layer. Derived from the `inDefault` flag so the catalog stays the single
 * source of truth; part names are unique, so the result has no duplicates (Req 3.5).
 */
export const DEFAULT_COMPOSITION: readonly string[] = COMPOSABLE_SLOTS.filter((slot) => slot.inDefault).map(
  (slot) => slot.name,
);

/**
 * Audio default composition: the parts a bare `<AudioPlayer url=… />` renders (monolithic mode)
 * — `[AudioControls, PlayButton, SkipBack, SkipForward, Title, Chapters, Volume, Settings]`
 * (Req 3.8). Derived from the `inDefaultAudio` flag so the audio default stays sourced from the
 * one catalog (A7), mirroring how `DEFAULT_COMPOSITION` derives from `inDefault` for video. Part
 * names are unique, so the result has no duplicates. `PrevButton`/`NextButton` are NOT flagged, so
 * nav is excluded from the default: it activates via `showNavButtons` (monolithic) or the presence
 * of `PrevButton`/`NextButton` (composed) (Req 3.9). The array's order is the catalog order; the
 * actual DOM order is always resolved through `resolveSlotOrder`, so membership is what matters.
 */
export const AUDIO_DEFAULT_COMPOSITION: readonly string[] = COMPOSABLE_SLOTS.filter(
  (slot) => slot.inDefaultAudio === true,
).map((slot) => slot.name);

/**
 * Sorts a collection of part names by their canonical `order`, ascending (Req 3.6). Pure:
 * returns a NEW array (never mutates the input) and is independent of the input order. Names
 * absent from `COMPOSABLE_SLOTS` are excluded from the result (Req 3.8).
 */
export function resolveSlotOrder(names: readonly string[]): string[] {
  const orderByName = new Map(COMPOSABLE_SLOTS.map((slot) => [slot.name, slot.order] as const));
  return names
    .filter((name) => orderByName.has(name))
    .sort((a, b) => (orderByName.get(a) ?? 0) - (orderByName.get(b) ?? 0));
}

/**
 * Lookup of every slot that carries a container-placement restriction (Req 16), mapping the
 * part name → its allowed container names. Built once from the catalog so the rule has a single
 * source of truth (A6/A7): today `Timeline`/`Chapters`/`Heatmap` → `['BottomBar']`.
 */
const ALLOWED_CONTAINERS_BY_NAME = new Map<string, readonly string[]>(
  COMPOSABLE_SLOTS.filter((slot) => slot.allowedContainers != null).map(
    (slot) => [slot.name, slot.allowedContainers as readonly string[]] as const,
  ),
);

/** Outcome of a placement check: `ok` plus, when invalid, the human-readable reason. */
export interface SlotPlacementResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Validates that a composable `partName` is allowed to sit inside `containerName` (Req 16). Pure
 * and framework-agnostic: it only consults the catalog's `allowedContainers`, so every skin
 * enforces the identical rule from this one function (A7). A part with NO restriction is always
 * allowed. A restricted part is allowed ONLY inside one of its listed containers; anywhere else
 * (a different container, or the shared/top level where `containerName` is `null`) is invalid and
 * the returned `reason` names the part and the required container(s) for the thrown error.
 */
export function validateSlotPlacement(partName: string, containerName: string | null): SlotPlacementResult {
  const allowed = ALLOWED_CONTAINERS_BY_NAME.get(partName);
  if (allowed == null) {
    return { ok: true };
  }
  if (containerName != null && allowed.includes(containerName)) {
    return { ok: true };
  }
  const where = containerName == null ? 'at the top level' : `inside <${containerName}>`;
  const targets = allowed.map((name) => `<${name}>`).join(' or ');
  return {
    ok: false,
    reason: `<${partName}> can only be used inside ${targets}, not ${where}.`,
  };
}
