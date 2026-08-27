/**
 * `playerstack-settings` — the settings control that surfaces playback speed and quality
 * behind a gear button with a two-level menu/submenu (Req 1.4, 1.5, 1.6, 2.1, 3.3, 5.1, 5.3).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element or a Controller directly. Selecting a SPEED option only expresses intent via
 * a bubbling + composed `playerstack-rate-request` (`detail: { rate }`) that the
 * `MediaController` routes to the `PlayerAdapter` (Req 2.1). Selecting a QUALITY option emits
 * a custom `playerstack-quality-request` (`detail: { value }`): the defined request set only
 * maps `rate` among settings, so quality is surfaced as a dedicated, adapter-extensible event
 * that a Skin/MediaController can wire later without changing this element.
 *
 * The menu STRUCTURE is built from the SAME pure helper the rest of Core uses,
 * `buildSettingsOptions` (from `@ui-utils`), so the Speed defaults and the Quality entries (plus the
 * trailing `Auto`) match everywhere. Local open/closed UI state mirrors `settingsInitialState`
 * (also from `@ui-utils`) so the "which panel is open" bookkeeping stays consistent with the headless
 * layer. The open state is reflected as `data-open` on the host so the Style_Layer can show/hide
 * the panel through `:host([data-open]) [part='menu']` (Req 3.3).
 *
 * Accessibility (Req 1.5): the rendered `<button>` carries the implicit ARIA `button` role, and
 * its accessible name is configurable through the `aria-label` attribute; when omitted, the
 * default English label applies.
 */
import type {
  SettingsCaptionTrack,
  SettingsDefaultLabel,
  SettingsI18n,
  SettingsQualityOption,
} from '@typings/ui/playerstack-settings.types';
import type { SettingsOption } from '@typings/ui.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import type { CaptionStyleOptions } from '@typings/utils/captions.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { buildSettingsOptions, buildSettingsLabel, settingsInitialState } from '@ui-utils';
import { CAPTION_STYLE_OPTIONS, DEFAULT_CAPTION_STYLE } from '@utils/captions';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { settingsIcon, arrowLeftIcon, arrowRightIcon } from '@icons/index';
import en from '@i18n/en';
import { getTranslations } from '@i18n/index';

/** Default accessible name used when no `aria-label` attribute is provided (Req 1.5). */
const DEFAULT_LABEL: SettingsDefaultLabel = 'Settings';

/** The top-level Speed entry `value` produced by `buildSettingsOptions`. */
const SPEED_KEY = 'speed';

/** The top-level Quality entry `value` produced by `buildSettingsOptions`. */
const QUALITY_KEY = 'quality';

/** The top-level Captions entry `value` produced by `buildSettingsOptions`. */
const CAPTIONS_KEY = 'captions';

/** Sentinel option `value` for turning captions OFF (parity with the original `'off'`). */
const CAPTION_OFF = 'off';

/**
 * The ordered list of caption STYLE properties surfaced by the "Options" panel (parity with the
 * original desktop `CaptionOptions` `OPTIONS_MAP`). Each `key` maps into `CAPTION_STYLE_OPTIONS`
 * (the value list) and into the i18n bag (the row label).
 */
const CAPTION_STYLE_KEYS: ReadonlyArray<keyof CaptionStyleOptions> = [
  'fontFamily',
  'fontColor',
  'fontSize',
  'fontOpacity',
  'backgroundColor',
  'backgroundOpacity',
  'windowColor',
  'windowOpacity',
  'edgeStyle',
];

export class PlayerstackSettings extends PlayerstackElement {
  /**
   * Declares `aria-label` as an observed attribute so the settings button's accessible name
   * is configurable via markup (Req 1.5). Keying the schema by `label` while mapping to the
   * `aria-label` attribute keeps the prop name readable and drives `observedAttributes`.
   */
  static override attributeSchema = {
    label: { attribute: 'aria-label', type: 'string' },
  } as const;

  /**
   * Public quality options fed into `buildSettingsOptions`. Defaults to an empty list so the
   * element renders a Speed-only menu until a Skin provides qualities. Setting it re-renders
   * the menu so the new entries appear immediately.
   */
  private _qualityOptions: SettingsQualityOption[] = [];

  /**
   * Minimal i18n bag; defaults to `null` so the element falls back to the English labels from
   * `@i18n`. Setting it re-renders the menu so translated labels apply.
   */
  private _i18n: SettingsI18n | null = null;

  /**
   * Ad-mode flag (default `false`). When `true` it is forwarded to `buildSettingsOptions`,
   * which drops the Speed category (`if (!live && !adMode)`) so speed can NOT be changed during
   * an ad — mirroring the original `useSettingsOptions({ adMode })` behavior. If the resulting
   * option set is EMPTY (e.g. an ad with no quality/caption options) the settings button hides
   * itself via `data-empty`, matching the original `if (settingsOptions.length === 0) return null`.
   */
  private _adMode = false;

  /**
   * Live flag (default `false`). When `true` it is forwarded to `buildSettingsOptions`, which
   * drops the Speed category (`if (!live && !adMode)`) so playback speed can NOT be changed on a
   * live stream — parity with the original `useSettingsOptions({ live })`. If the resulting option
   * set is EMPTY (a live stream with no quality/caption options) the settings button hides itself
   * via `data-empty`, matching the original `if (settingsOptions.length === 0) return null`.
   */
  private _live = false;

  /**
   * Public caption tracks fed into `buildSettingsOptions` as the Captions category options
   * (parity with the original desktop settings Captions entry). Defaults to an empty list so no
   * Captions category renders until a Skin provides tracks. Setting it re-renders the menu.
   */
  private _captions: SettingsCaptionTrack[] = [];

  /**
   * The currently active caption language (`null` = Off). Mirrored so the Captions submenu marks
   * the active track and the main row shows the current value (parity with the original
   * `values.captions`). Set through the property channel; re-renders the panels.
   */
  private _activeCaption: string | null = null;

  /**
   * The current caption STYLE (parity with the original `captionStyle`). Drives the current-value
   * labels + active marks in the "Options" style panel. Defaults to `DEFAULT_CAPTION_STYLE`.
   */
  private _captionStyle: CaptionStyleOptions = { ...DEFAULT_CAPTION_STYLE };

  /**
   * Local open/closed UI state mirroring `settingsInitialState` from `@ui-utils`. `generalMenu`
   * tracks whether the main panel is open; `speed`/`quality`/`captions` track which submenu is
   * open (Captions now IS owned by this element — parity with the original desktop settings).
   */
  private uiState: { generalMenu: boolean; speed: boolean; quality: boolean; captions: boolean } = {
    ...settingsInitialState,
  };

  /**
   * Whether the caption STYLE "Options" panel is open (parity with the original
   * `showCaptionOptions`). It layers over the Captions submenu, reached via the "Options"
   * affordance in the Captions submenu header.
   */
  private captionOptionsOpen = false;

  /**
   * Which caption-style PROPERTY sub-page is open inside the "Options" panel (`null` = the
   * style-property list). Mirrors the original `CaptionOptions` `subMenu`.
   */
  private captionStyleSubKey: keyof CaptionStyleOptions | null = null;

  /** The rendered settings button; kept so `render` stays idempotent across reconnects. */
  private settingsButton: HTMLButtonElement | null = null;

  /** The rendered main menu panel; kept so submenu navigation can rebuild its contents. */
  private menu: HTMLDivElement | null = null;

  /** The rendered submenu panel; kept so a category selection can populate + reveal it. */
  private submenu: HTMLDivElement | null = null;

  /** The rendered caption STYLE "Options" panel; kept so it can be populated + revealed. */
  private captionOptionsPanel: HTMLDivElement | null = null;

  /** Latest playbackRate mirrored from the store, used to mark the active speed option. */
  private playbackRate = 1;

  /** Latest playbackQuality mirrored from the store, used to mark the active quality option. */
  private playbackQuality: number | null = null;

  /**
   * Timer id for the submenu slide-in reveal. The original `DropdownOverlay` flips a local
   * `show` flag 100ms AFTER the panel becomes visible so the content transitions in from the
   * right (`translateX(100px)->0`). We mirror that by toggling `data-show` on the submenu on a
   * short timeout, cleared on every navigation so a rapid open/close never leaves it stuck.
   */
  private submenuShowTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Public setter for the quality option list (default `[]`). Rebuilds the menu so the new
   * qualities appear right away, keeping the Markup_Contract in sync with the input.
   */
  set qualityOptions(options: SettingsQualityOption[]) {
    this._qualityOptions = Array.isArray(options) ? options : [];
    this.rebuildMenu();
  }

  get qualityOptions(): SettingsQualityOption[] {
    return this._qualityOptions;
  }

  /**
   * Public setter for the minimal i18n label bag. Rebuilds the menu so translated labels
   * apply immediately; passing `null` restores the English defaults.
   */
  set i18n(value: SettingsI18n | null) {
    this._i18n = value;
    this.rebuildMenu();
  }

  get i18n(): SettingsI18n | null {
    return this._i18n;
  }

  /**
   * Public setter for the ad-mode flag (default `false`). Rebuilds the menu so the Speed
   * category is dropped and the empty-options guard re-evaluates immediately when an ad starts
   * or ends. Coerced to a boolean so a truthy/falsy prop assignment behaves predictably.
   */
  set adMode(value: boolean) {
    this._adMode = Boolean(value);
    this.rebuildMenu();
  }

  get adMode(): boolean {
    return this._adMode;
  }

  /**
   * Public setter for the live flag (default `false`). Rebuilds the menu so the Speed category is
   * dropped on a live stream and the empty-options guard re-evaluates immediately (hiding the gear
   * when a live stream exposes no quality/caption options), matching the original hook.
   */
  set live(value: boolean) {
    this._live = Boolean(value);
    this.rebuildMenu();
  }

  get live(): boolean {
    return this._live;
  }

  /**
   * Public setter for the caption tracks (default `[]`). Rebuilds the menu so the Captions
   * category appears/updates immediately (parity with the original desktop settings captions).
   */
  set captions(value: SettingsCaptionTrack[]) {
    this._captions = Array.isArray(value) ? value : [];
    this.rebuildMenu();
  }

  get captions(): SettingsCaptionTrack[] {
    return this._captions;
  }

  /**
   * Public setter for the active caption language (`null` = Off). Rebuilds so the current-value
   * label + active mark reflect the external selection (e.g. the CC quick-toggle button).
   */
  set activeCaption(value: string | null) {
    this._activeCaption = value ?? null;
    this.rebuildMenu();
  }

  get activeCaption(): string | null {
    return this._activeCaption;
  }

  /**
   * Public setter for the caption style (default `DEFAULT_CAPTION_STYLE`). Rebuilds so the style
   * "Options" panel reflects the current values (parity with the original `captionStyle` prop).
   */
  set captionStyle(value: CaptionStyleOptions | null) {
    this._captionStyle = value ? { ...DEFAULT_CAPTION_STYLE, ...value } : { ...DEFAULT_CAPTION_STYLE };
    this.rebuildMenu();
  }

  get captionStyle(): CaptionStyleOptions {
    return this._captionStyle;
  }

  /**
   * Tracks the current playbackRate/quality from the store so the active option can be marked
   * (Req 3.3). Reflects `data-quality` on the host as a stable state hook and re-marks the
   * active entries in whichever panel is currently rendered. Also updates the "HD" badge and
   * refreshes the current-value labels in the main menu rows.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.playbackRate = state.playbackRate;
    this.playbackQuality = state.playbackQuality;
    // Mirror the active caption from the store so a CC quick-toggle (which sets `activeCaption`
    // on the store) keeps the Captions row value + submenu active-mark in sync without the Skin
    // having to also push the `activeCaption` property (parity with the original
    // `useSettingsOptions` effect that synced `values.captions` from `activeCaption`).
    const storeCaption = state.activeCaption ?? null;
    if (storeCaption !== this._activeCaption) {
      this._activeCaption = storeCaption;
      this.renderPanels();
    }
    this.reflectState({ quality: state.playbackQuality });
    this.markActiveOptions();
    this.refreshValueLabels();
    this.refreshFullHDBadge();
  }

  /**
   * Refreshes the current-value text in each visible main-menu row. Called from `onStoreChange`
   * so the displayed label (e.g. "Normal" for speed, "720p" for quality) stays in sync without a
   * full `renderPanels` rebuild.
   */
  private refreshValueLabels(): void {
    if (this.menu === null) {
      return;
    }
    const i18n = this.resolveI18n();
    const items = this.menu.querySelectorAll('[part="menu-item"]');
    items.forEach((node) => {
      const element = node as HTMLElement;
      const category = element.getAttribute('data-category') ?? '';
      const valueSpan = element.querySelector('[part="menu-item-value"]') as HTMLElement | null;
      if (valueSpan) {
        valueSpan.textContent = this.currentValueLabel(category, i18n);
      }
    });
  }

  /**
   * Updates the `data-fullhd` host attribute based on the current tracked quality, so the gear's
   * "HD" badge shows/hides without waiting for a full `renderPanels` cycle.
   */
  private refreshFullHDBadge(): void {
    if (this.isActiveQualityFullHD()) {
      this.setAttribute('data-fullhd', 'true');
    } else {
      this.removeAttribute('data-fullhd');
    }
  }

  /**
   * Resolves the effective i18n bag: the consumer-provided labels take precedence, then the
   * English defaults from `@i18n`. Returned as the loose `SettingsI18n` shape that
   * `buildSettingsOptions`/`buildSettingsLabel` accept.
   */
  private resolveI18n(): SettingsI18n {
    // Resolve the FULL localized dictionary from the `language` field (parity with the other i18n
    // elements + the original `useAppSelector().i18n`), then layer any explicit overrides on top.
    // The Skin passes `{ language }`, so without this the menu (Speed/Quality/Captions + the new
    // caption-STYLE labels) would always render English. Explicit label keys still win.
    const language = typeof this._i18n?.language === 'string' ? this._i18n.language : undefined;
    const base = language ? getTranslations(language) : en;
    return { ...(base as SettingsI18n), ...(this._i18n ?? {}) };
  }

  /**
   * Builds the top-level settings structure from the SAME pure helper the rest of Core uses
   * (Req 1.6). Both `live` and `adMode` are forwarded from the public flags so either one drops
   * the Speed category (speed is not changeable on a live stream nor during an ad), matching the
   * original `useSettingsOptions({ live, adMode })` hook.
   */
  private buildOptions(): SettingsOption[] {
    // Captions category options mirror the original `useSettingsOptions.captionOptions`: one entry
    // per track (`{ label, value: language }`); `buildSettingsOptions` prepends the "Off" row.
    const captionOptions =
      this._captions.length > 0 ? this._captions.map((track) => ({ label: track.label, value: track.language })) : null;
    return buildSettingsOptions({
      qualityOptions: this._qualityOptions,
      captionOptions,
      live: this._live,
      adMode: this._adMode,
      i18n: this.resolveI18n(),
    });
  }

  /**
   * Resolves the CURRENT value label shown on a main-menu row (the original `values[item.value]`
   * — e.g. Speed row shows "Normal", Quality row shows the active resolution or "Auto"). Speed
   * derives from the tracked `playbackRate`; quality maps the tracked `playbackQuality` to its
   * option label (0/absent -> "Auto"). Uses the shared `buildSettingsLabel` so labels match the
   * rest of Core (Req 1.6).
   */
  private currentValueLabel(category: string, i18n: SettingsI18n): string {
    if (category === SPEED_KEY) {
      return buildSettingsLabel({ label: SPEED_KEY, value: String(this.playbackRate), i18n });
    }
    if (category === QUALITY_KEY) {
      const q = this.playbackQuality ?? 0;
      return buildSettingsLabel({ label: QUALITY_KEY, value: String(q), i18n });
    }
    if (category === CAPTIONS_KEY) {
      // Off when no active caption; else the active track's label (parity with `values.captions`).
      if (this._activeCaption === null) {
        return i18n.off ?? 'Off';
      }
      const track = this._captions.find((t) => t.language === this._activeCaption);
      return track?.label ?? this._activeCaption;
    }
    return '';
  }

  /**
   * Reports whether the currently active QUALITY option is full-HD, so the gear button can show
   * the "HD" badge (original `values.quality?.isFullHD`). Matches the tracked `playbackQuality`
   * against the provided `qualityOptions` and reads their `isFullHD` flag.
   */
  private isActiveQualityFullHD(): boolean {
    const q = this.playbackQuality;
    if (q === null || q === 0) {
      return false;
    }
    const match = this._qualityOptions.find((option) => option.value === String(q));
    return match?.isFullHD === true;
  }

  /**
   * Toggles the main menu open/closed and reflects `data-open` on the host (Req 3.3). Closing
   * the menu also resets the submenu selection so the next open starts at the top level,
   * mirroring `settingsInitialState`.
   */
  private toggleMenu(): void {
    const nextOpen = !this.uiState.generalMenu;
    // Closing (or reopening) the menu always drops the caption STYLE overlay so it never lingers
    // behind a hidden panel (parity with the original: the settings menu owns `showCaptionOptions`
    // and resets it when the menu closes).
    this.captionOptionsOpen = false;
    this.captionStyleSubKey = null;
    this.uiState = nextOpen ? { ...settingsInitialState, generalMenu: true } : { ...settingsInitialState };
    this.reflectOpenState();
    this.renderPanels();
  }

  /**
   * Opens the submenu for a given top-level category (`speed`/`quality`/`captions`), keeping the
   * main menu open. Populates and reveals the submenu with that category's options. Opening any
   * submenu closes the caption STYLE "Options" overlay.
   */
  private openSubmenu(category: typeof SPEED_KEY | typeof QUALITY_KEY | typeof CAPTIONS_KEY): void {
    this.captionOptionsOpen = false;
    this.captionStyleSubKey = null;
    this.uiState = {
      ...settingsInitialState,
      generalMenu: true,
      speed: category === SPEED_KEY,
      quality: category === QUALITY_KEY,
      captions: category === CAPTIONS_KEY,
    };
    this.renderPanels();
  }

  /**
   * Opens the caption STYLE "Options" panel (parity with the original `setShowCaptionOptions(true)`),
   * keeping the Captions submenu state so closing returns to it.
   */
  private openCaptionOptions(): void {
    this.captionOptionsOpen = true;
    this.captionStyleSubKey = null;
    this.uiState = { ...settingsInitialState, generalMenu: true, captions: true };
    this.renderPanels();
  }

  /**
   * Closes the caption STYLE "Options" panel and returns to the Captions submenu (parity with the
   * original `onClose` -> `handleMenuItemClick('captions')`).
   */
  private closeCaptionOptions(): void {
    this.captionOptionsOpen = false;
    this.captionStyleSubKey = null;
    this.renderPanels();
  }

  /**
   * Reflects whether the built option set is empty onto `data-empty` on the host so the
   * Style_Layer hides the whole settings control (`playerstack-settings[data-empty]{display:none}`),
   * mirroring the original component returning `null` when `settingsOptions.length === 0`. When
   * empty it also resets the local open state so no panel is left open behind the hidden button.
   */
  private reflectEmptyState(isEmpty: boolean): void {
    if (isEmpty) {
      this.setAttribute('data-empty', 'true');
      // A hidden control must not keep an open menu; reset the bookkeeping + `data-open`.
      this.uiState = { ...settingsInitialState };
      this.reflectOpenState();
    } else {
      this.removeAttribute('data-empty');
    }
  }

  /** Reflects the current open state to `data-open` on the host so the Style_Layer reacts. */
  private reflectOpenState(): void {
    if (this.uiState.generalMenu) {
      this.setAttribute('data-open', 'true');
    } else {
      this.removeAttribute('data-open');
    }
  }

  /**
   * Emits the request for a selected option. Speed selections map to the defined
   * `playerstack-rate-request` (`{ rate }`, Req 2.1); quality selections emit the custom,
   * adapter-extensible `playerstack-quality-request` (`{ value }`). The panel closes after a
   * selection so the interaction reads as "pick and dismiss".
   */
  private selectOption(category: typeof SPEED_KEY | typeof QUALITY_KEY | typeof CAPTIONS_KEY, value: string): void {
    if (category === SPEED_KEY) {
      this.dispatchRequest('playerstack-rate-request', { rate: Number(value) });
    } else if (category === QUALITY_KEY) {
      this.dispatchRequest('playerstack-quality-request', { value });
    } else {
      // Caption language selection (parity with the original `onCaptionChange(value === 'off' ?
      // null : value)`): the request detail carries `null` for Off so the Skin turns captions off.
      this.dispatchRequest('playerstack-caption-request', { value: value === CAPTION_OFF ? null : value });
    }
    this.captionOptionsOpen = false;
    this.captionStyleSubKey = null;
    this.uiState = { ...settingsInitialState };
    this.reflectOpenState();
    this.renderPanels();
  }

  /**
   * Applies a caption STYLE change (parity with the original `handleSelectValue`): merges the new
   * `{ [key]: value }` into the current style and emits `playerstack-caption-style-request`
   * (`{ style }`) so the Skin persists it (cookie) + feeds the overlay. Returns to the style list.
   */
  private selectCaptionStyle(key: keyof CaptionStyleOptions, value: string): void {
    const nextStyle: CaptionStyleOptions = { ...this._captionStyle, [key]: value };
    this._captionStyle = nextStyle;
    this.dispatchRequest('playerstack-caption-style-request', { style: nextStyle });
    this.captionStyleSubKey = null;
    this.renderPanels();
  }

  /**
   * Resets the caption style to the defaults (parity with the original Reset row ->
   * `onStyleChange(DEFAULT_CAPTION_STYLE)`), emitting the style request so the Skin persists it.
   */
  private resetCaptionStyle(): void {
    const nextStyle: CaptionStyleOptions = { ...DEFAULT_CAPTION_STYLE };
    this._captionStyle = nextStyle;
    this.dispatchRequest('playerstack-caption-style-request', { style: nextStyle });
    this.captionStyleSubKey = null;
    this.renderPanels();
  }

  /**
   * Builds the settings button and the (initially hidden) menu/submenu panels. Nodes are
   * created and APPENDED (never via `innerHTML`) so the adopted Style_Layer — in the fallback
   * path an injected `<style>` — is preserved. A guard keeps `render` idempotent across
   * reconnects.
   */
  protected render(): void {
    if (this.settingsButton !== null) {
      return;
    }

    const button = document.createElement('button');
    button.setAttribute('part', 'settings-button');
    button.setAttribute('type', 'button');
    // Accessible name from the host's `aria-label` when set, else the default (Req 1.5).
    button.setAttribute('aria-label', this.getAttribute('aria-label') ?? DEFAULT_LABEL);

    // Gear glyph: class names match the Style_Layer selectors that render the settings icon.
    const icon = document.createElement('span');
    icon.className = 'icon icon-settings';
    // Inject the real gear SVG glyph into the span's OWN innerHTML (safe: the serializer
    // escapes attribute values). The span belongs to this element, not the shadow root, so the
    // adopted Style_Layer survives. The `icon-settings` class is kept for Style_Layer targeting.
    icon.innerHTML = renderSvgFromDescriptor(settingsIcon);
    button.appendChild(icon);

    const onButtonClick = (): void => this.toggleMenu();
    button.addEventListener('click', onButtonClick);
    this.addDisposer(() => button.removeEventListener('click', onButtonClick));

    const menu = document.createElement('div');
    menu.setAttribute('part', 'menu');

    const submenu = document.createElement('div');
    submenu.setAttribute('part', 'submenu');

    // Caption STYLE "Options" panel (parity with the original `CaptionOptions`), rendered on
    // demand when the "Options" affordance is used. Hidden by default; the Style_Layer reveals it
    // while the host reflects `data-caption-options`.
    const captionOptionsPanel = document.createElement('div');
    captionOptionsPanel.setAttribute('part', 'caption-options');

    this.settingsButton = button;
    this.menu = menu;
    this.submenu = submenu;
    this.captionOptionsPanel = captionOptionsPanel;

    // Ensure a pending slide-in timer never survives teardown.
    this.addDisposer(() => this.clearSubmenuReveal());

    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(button);
    this.root.appendChild(menu);
    this.root.appendChild(submenu);
    this.root.appendChild(captionOptionsPanel);

    this.reflectOpenState();
    this.renderPanels();
  }

  /**
   * Rebuilds the menu contents when the inputs (`qualityOptions`/`i18n`) change after the
   * initial render. No-op before `render` has created the panels.
   */
  private rebuildMenu(): void {
    if (this.menu === null) {
      return;
    }
    this.renderPanels();
  }

  /**
   * Renders the top-level menu and, when a category is open, its submenu. Rebuilds the panel
   * children from the freshly-built option structure so navigation state and inputs stay
   * reflected in the DOM. Active options are marked afterwards.
   *
   * Structure mirrors the original two-level dropdown: each MAIN row shows `{label} …
   * {current value} ›` (`StyledDropdownTitle` + `StyledDropdownValue` + `ArrowRightIcon`).
   * Opening a category REPLACES the main menu with a submenu that has a back-navigation header
   * (`StyledDropdownHeader`: `ArrowLeftIcon` + category title) plus the option list; the
   * whichever-panel-is-open bookkeeping drives `data-submenu` on the host so the Style_Layer can
   * hide the main menu while a submenu is open. The active quality full-HD state drives
   * `data-fullhd` for the gear's "HD" badge.
   */
  private renderPanels(): void {
    if (this.menu === null || this.submenu === null) {
      return;
    }

    const options = this.buildOptions();
    const i18n = this.resolveI18n();

    // Empty-options guard (parity with the original `if (settingsOptions.length === 0) return null`):
    // when there is nothing to configure — e.g. an ad with no quality/caption options — reflect
    // `data-empty` on the host so the Style_Layer hides the settings button entirely, and close
    // any open panel so a dangling menu can't linger. When options come back, drop `data-empty`.
    this.reflectEmptyState(options.length === 0);

    // "HD" badge on the gear when the ACTIVE quality is full-HD (original `values.quality?.isFullHD`).
    if (this.isActiveQualityFullHD()) {
      this.setAttribute('data-fullhd', 'true');
    } else {
      this.removeAttribute('data-fullhd');
    }

    // Which submenu (if any) is currently open (now includes Captions — parity with the original
    // desktop settings, which owned the Captions category).
    const openCategory = this.uiState.speed
      ? SPEED_KEY
      : this.uiState.quality
        ? QUALITY_KEY
        : this.uiState.captions
          ? CAPTIONS_KEY
          : null;
    // Reflect the open submenu so the Style_Layer hides the main menu behind it.
    if (openCategory !== null) {
      this.setAttribute('data-submenu', openCategory);
    } else {
      this.removeAttribute('data-submenu');
    }
    // Reflect whether the caption STYLE "Options" panel is open so the Style_Layer reveals it over
    // the Captions submenu (parity with the original `showCaptionOptions`).
    if (this.captionOptionsOpen) {
      this.setAttribute('data-caption-options', 'true');
    } else {
      this.removeAttribute('data-caption-options');
    }

    // Main menu: one row per top-level category (Speed / Quality). Each row shows the label on
    // the left and the current value + right-chevron on the right; clicking opens its submenu.
    this.menu.replaceChildren();
    for (const option of options) {
      const item = document.createElement('button');
      item.setAttribute('type', 'button');
      item.setAttribute('part', 'menu-item');
      item.setAttribute('data-category', option.value);

      const title = document.createElement('span');
      title.setAttribute('part', 'menu-item-title');
      title.textContent = option.label;

      const value = document.createElement('span');
      value.setAttribute('part', 'menu-item-value');
      value.textContent = this.currentValueLabel(option.value, i18n);

      const arrow = document.createElement('span');
      arrow.setAttribute('part', 'menu-item-arrow');
      arrow.className = 'icon';
      arrow.innerHTML = renderSvgFromDescriptor(arrowRightIcon);

      item.appendChild(title);
      item.appendChild(value);
      item.appendChild(arrow);

      const onItemClick = (): void => {
        if (option.value === SPEED_KEY || option.value === QUALITY_KEY || option.value === CAPTIONS_KEY) {
          this.openSubmenu(option.value);
        }
      };
      item.addEventListener('click', onItemClick);
      this.addDisposer(() => item.removeEventListener('click', onItemClick));
      this.menu.appendChild(item);
    }

    // Submenu: a back-navigation header + the option list for whichever category is open.
    this.submenu.replaceChildren();
    if (openCategory !== null) {
      const category = options.find((option) => option.value === openCategory);

      // Header (StyledDropdownHeader): back button = left-arrow glyph + category title.
      const header = document.createElement('div');
      header.setAttribute('part', 'submenu-header');

      const back = document.createElement('button');
      back.setAttribute('type', 'button');
      back.setAttribute('part', 'submenu-back');

      const backArrow = document.createElement('span');
      backArrow.className = 'icon';
      backArrow.innerHTML = renderSvgFromDescriptor(arrowLeftIcon);

      const backTitle = document.createElement('span');
      backTitle.textContent = category?.label ?? '';

      back.appendChild(backArrow);
      back.appendChild(backTitle);

      const onBack = (): void => this.goBackToMenu();
      back.addEventListener('click', onBack);
      this.addDisposer(() => back.removeEventListener('click', onBack));
      header.appendChild(back);

      // Captions submenu header carries an "Options" affordance (parity with the original
      // DropdownOverlay `showOptionsButton` -> `onOptionsClick`) that opens the caption STYLE panel.
      if (openCategory === CAPTIONS_KEY) {
        const optionsLink = document.createElement('button');
        optionsLink.setAttribute('type', 'button');
        optionsLink.setAttribute('part', 'submenu-options');
        optionsLink.textContent = i18n.captionOptions ?? 'Options';
        const onOptions = (event: Event): void => {
          event.stopPropagation();
          this.openCaptionOptions();
        };
        optionsLink.addEventListener('click', onOptions);
        this.addDisposer(() => optionsLink.removeEventListener('click', onOptions));
        header.appendChild(optionsLink);
      }
      this.submenu.appendChild(header);

      // Content wrapper (StyledDropdownContent): slide-in reveal target.
      const content = document.createElement('div');
      content.setAttribute('part', 'submenu-content');

      for (const child of category?.options ?? []) {
        const item = document.createElement('button');
        item.setAttribute('type', 'button');
        item.setAttribute('part', 'submenu-item');
        item.setAttribute('data-value', child.value);
        // Captions rows use their descriptor label directly (Off / track label). Speed/Quality
        // reuse the shared label builder so e.g. speed `1` reads "Normal" and quality `0` reads
        // "Auto" consistently with the rest of Core (Req 1.6).
        item.textContent =
          openCategory === CAPTIONS_KEY
            ? child.label
            : buildSettingsLabel({ label: openCategory, value: child.value, i18n });

        // Full-HD quality options carry an "HD" sub-badge (StyledDropdownItemValueSub).
        if (openCategory === QUALITY_KEY && child.isFullHD === true) {
          const badge = document.createElement('sub');
          badge.setAttribute('part', 'hd-badge');
          badge.textContent = i18n.hd ?? 'HD';
          item.appendChild(badge);
        }

        const onChildClick = (): void => this.selectOption(openCategory, child.value);
        item.addEventListener('click', onChildClick);
        this.addDisposer(() => item.removeEventListener('click', onChildClick));
        content.appendChild(item);
      }
      this.submenu.appendChild(content);

      // Slide-in reveal: original flips `show` 100ms after the panel is shown so the content
      // transitions from translateX(100px)->0. Toggle `data-show` on a short timeout, resetting
      // it first so a fresh navigation always re-plays the animation.
      this.scheduleSubmenuReveal();
    } else {
      this.clearSubmenuReveal();
    }

    this.renderCaptionOptionsPanel(i18n);
    this.markActiveOptions();
  }

  /**
   * Renders the caption STYLE "Options" panel (parity with the original `CaptionOptions`). It is a
   * SEPARATE two-level panel layered over the Captions submenu:
   *   - the MAIN page lists the nine style PROPERTIES (`{label} … {current value} ›`) plus a
   *     "Reset" row (`onStyleChange(DEFAULT_CAPTION_STYLE)`), with a header back button ("Options")
   *     that returns to the Captions submenu;
   *   - drilling into a property REPLACES the list with that property's VALUE options (a check on
   *     the active one), with a header back button labelled with the property name.
   * Only (re)built when the panel is open; otherwise its children are cleared.
   */
  private renderCaptionOptionsPanel(i18n: SettingsI18n): void {
    if (this.captionOptionsPanel === null) {
      return;
    }
    this.captionOptionsPanel.replaceChildren();
    if (!this.captionOptionsOpen) {
      return;
    }

    const subKey = this.captionStyleSubKey;

    // Header: back button (arrow + label). At the property list the label is "Options" and back
    // returns to the Captions submenu; inside a property the label is the property name and back
    // returns to the property list.
    const header = document.createElement('div');
    header.setAttribute('part', 'caption-options-header');

    const back = document.createElement('button');
    back.setAttribute('type', 'button');
    back.setAttribute('part', 'submenu-back');

    const backArrow = document.createElement('span');
    backArrow.className = 'icon';
    backArrow.innerHTML = renderSvgFromDescriptor(arrowLeftIcon);

    const backTitle = document.createElement('span');
    backTitle.textContent = subKey ? (i18n[subKey] ?? subKey) : (i18n.captionOptions ?? 'Options');

    back.appendChild(backArrow);
    back.appendChild(backTitle);

    const onBack = (): void => {
      if (this.captionStyleSubKey !== null) {
        this.captionStyleSubKey = null;
        this.renderPanels();
      } else {
        this.closeCaptionOptions();
      }
    };
    back.addEventListener('click', onBack);
    this.addDisposer(() => back.removeEventListener('click', onBack));
    header.appendChild(back);
    this.captionOptionsPanel.appendChild(header);

    const content = document.createElement('div');
    content.setAttribute('part', 'caption-options-content');

    if (subKey === null) {
      // Property list: one row per style property + a trailing Reset row.
      for (const key of CAPTION_STYLE_KEYS) {
        const item = document.createElement('button');
        item.setAttribute('type', 'button');
        item.setAttribute('part', 'caption-options-item');
        item.setAttribute('data-key', key);

        const label = document.createElement('span');
        label.setAttribute('part', 'caption-options-label');
        label.textContent = i18n[key] ?? key;

        const value = document.createElement('span');
        value.setAttribute('part', 'caption-options-value');
        value.textContent = this.captionStyleValueLabel(key);

        const arrow = document.createElement('span');
        arrow.className = 'icon';
        arrow.innerHTML = renderSvgFromDescriptor(arrowRightIcon);
        value.appendChild(arrow);

        item.appendChild(label);
        item.appendChild(value);

        const onOpenKey = (): void => {
          this.captionStyleSubKey = key;
          this.renderPanels();
        };
        item.addEventListener('click', onOpenKey);
        this.addDisposer(() => item.removeEventListener('click', onOpenKey));
        content.appendChild(item);
      }

      const reset = document.createElement('button');
      reset.setAttribute('type', 'button');
      reset.setAttribute('part', 'caption-options-item');
      reset.setAttribute('data-key', 'reset');
      const resetLabel = document.createElement('span');
      resetLabel.setAttribute('part', 'caption-options-label');
      resetLabel.textContent = i18n.reset ?? 'Reset';
      reset.appendChild(resetLabel);
      const onReset = (): void => this.resetCaptionStyle();
      reset.addEventListener('click', onReset);
      this.addDisposer(() => reset.removeEventListener('click', onReset));
      content.appendChild(reset);
    } else {
      // Value list for the drilled-in property: a check on the active value.
      const values = CAPTION_STYLE_OPTIONS[subKey] ?? [];
      const current = this._captionStyle[subKey];
      for (const option of values) {
        const item = document.createElement('button');
        item.setAttribute('type', 'button');
        item.setAttribute('part', 'submenu-item');
        item.setAttribute('data-value', option.value);
        item.textContent = (option.value === current ? '\u2713 ' : '') + option.label;
        if (option.value === current) {
          item.setAttribute('data-active', 'true');
        }
        const onSelect = (): void => this.selectCaptionStyle(subKey, option.value);
        item.addEventListener('click', onSelect);
        this.addDisposer(() => item.removeEventListener('click', onSelect));
        content.appendChild(item);
      }
    }

    this.captionOptionsPanel.appendChild(content);
  }

  /**
   * Resolves the current-value LABEL shown on a caption-style property row (parity with the
   * original `getCurrentLabel`): the matching option's label, or the raw stored value.
   */
  private captionStyleValueLabel(key: keyof CaptionStyleOptions): string {
    const values = CAPTION_STYLE_OPTIONS[key] ?? [];
    const current = this._captionStyle[key];
    const match = values.find((option) => option.value === current);
    return match?.label ?? String(current);
  }

  /**
   * Schedules the submenu slide-in: clears any pending timer, removes `data-show` so the panel
   * starts off-screen, then re-adds it after 100ms — mirroring the original `setShow(false)` +
   * `setTimeout(() => setShow(true), 100)`.
   */
  private scheduleSubmenuReveal(): void {
    this.clearSubmenuReveal();
    this.submenuShowTimer = setTimeout(() => {
      this.submenu?.setAttribute('data-show', 'true');
      this.submenuShowTimer = null;
    }, 100);
  }

  /** Clears the pending reveal timer and hides the slide-in state. */
  private clearSubmenuReveal(): void {
    if (this.submenuShowTimer !== null) {
      clearTimeout(this.submenuShowTimer);
      this.submenuShowTimer = null;
    }
    this.submenu?.removeAttribute('data-show');
  }

  /**
   * Returns from an open submenu to the main menu (original `handleGoBack`): keeps the general
   * menu open, clears the category selection, and re-renders so the main rows show again.
   */
  private goBackToMenu(): void {
    this.captionOptionsOpen = false;
    this.captionStyleSubKey = null;
    this.uiState = { ...settingsInitialState, generalMenu: true };
    this.renderPanels();
  }

  /**
   * Marks the active speed/quality option in the submenu with `data-active` so the Style_Layer
   * can highlight the current selection (Req 3.3). Kept simple: it toggles the attribute on the
   * matching `submenu-item` based on the tracked `playbackRate`/`playbackQuality`.
   */
  private markActiveOptions(): void {
    if (this.submenu === null) {
      return;
    }
    const openCategory = this.uiState.speed
      ? SPEED_KEY
      : this.uiState.quality
        ? QUALITY_KEY
        : this.uiState.captions
          ? CAPTIONS_KEY
          : null;
    const activeValue =
      openCategory === SPEED_KEY
        ? String(this.playbackRate)
        : openCategory === QUALITY_KEY
          ? String(this.playbackQuality ?? 0)
          : openCategory === CAPTIONS_KEY
            ? (this._activeCaption ?? CAPTION_OFF)
            : null;

    const items = this.submenu.querySelectorAll('[part="submenu-item"]');
    items.forEach((node) => {
      const element = node as HTMLElement;
      if (activeValue !== null && element.getAttribute('data-value') === activeValue) {
        element.setAttribute('data-active', 'true');
      } else {
        element.removeAttribute('data-active');
      }
    });
  }
}
