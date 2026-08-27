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
    attributes: ['aria-label', 'fill-origin'],
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
];
