/**
 * `playerstack-mobile-settings` — the full-surface mobile settings panel (parity with the
 * original `MobileSettingsPanel`). It shows a main page of "switch" cards (Quality / Speed /
 * Captions, each with the current value) and drills into a per-category option sub-page.
 *
 * As an interactive UI_Element it follows the Request/Response model: selecting an option only
 * expresses intent via bubbling + composed request events the `MediaController` routes:
 *   - speed  → `playerstack-rate-request` (`{ rate }`)
 *   - quality→ `playerstack-quality-request` (`{ value }`)
 *   - caption→ `playerstack-caption-request` (`{ value }`)
 *
 * The menu STRUCTURE reuses the SAME pure helpers as the rest of Core (`buildSettingsOptions` /
 * `buildSettingsLabel`) so the labels/order match everywhere (Req 1.6). Open state is reflected
 * as `data-settings-open` on the HOST so the Style_Layer slides the panel in; the open sub-page
 * is reflected as `data-subpage`. Gating mirrors the original: Speed is dropped in ad mode.
 */
import type {
  MobileSettingsCaptionTrack,
  MobileSettingsCategory,
  MobileSettingsI18n,
  MobileSettingsQualityOption,
} from '@typings/ui/playerstack-mobile-settings.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import { buildSettingsLabel } from '@ui-utils';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { mobileSettingsGearIcon, mobileSpeedIcon, mobileCaptionsIcon, mobileBackIcon } from '@icons/mobile/index';
import en from '@i18n/en';
import { getTranslations } from '@i18n/index';

/** Speed options mirrored from the original SPEED_OPTIONS (value order top→bottom). */
const SPEED_VALUES: readonly string[] = ['2', '1.5', '1.25', '1', '0.75', '0.5', '0.25'];

export class PlayerstackMobileSettings extends PlayerstackElement {
  private _qualityOptions: MobileSettingsQualityOption[] = [];
  private _captions: MobileSettingsCaptionTrack[] = [];
  private _i18n: MobileSettingsI18n | null = null;
  private _adMode = false;
  private _live = false;

  /** Latest store values used to mark active options + render current-value labels. */
  private playbackRate = 1;
  private playbackQuality: number | null = null;
  private activeCaption: string | null = null;

  /** Open state + which sub-page is open (null = main page). */
  private open = false;
  private subMenu: MobileSettingsCategory | null = null;

  private panel: HTMLElement | null = null;
  private grid: HTMLElement | null = null;
  private subContent: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private backButton: HTMLButtonElement | null = null;

  set qualityOptions(value: MobileSettingsQualityOption[]) {
    this._qualityOptions = Array.isArray(value) ? value : [];
    this.rebuild();
  }
  get qualityOptions(): MobileSettingsQualityOption[] {
    return this._qualityOptions;
  }

  set captions(value: MobileSettingsCaptionTrack[]) {
    this._captions = Array.isArray(value) ? value : [];
    this.rebuild();
  }
  get captions(): MobileSettingsCaptionTrack[] {
    return this._captions;
  }

  set i18n(value: MobileSettingsI18n | null) {
    this._i18n = value;
    this.rebuild();
  }
  get i18n(): MobileSettingsI18n | null {
    return this._i18n;
  }

  set adMode(value: boolean) {
    this._adMode = Boolean(value);
    this.rebuild();
  }
  get adMode(): boolean {
    return this._adMode;
  }

  /** Live flag: drops the Speed category on a live stream (parity with the desktop settings). */
  set live(value: boolean) {
    this._live = Boolean(value);
    this.rebuild();
  }
  get live(): boolean {
    return this._live;
  }

  /** Opens the panel (reflected as `data-settings-open` on the host) at the main page. */
  open_(): void {
    this.open = true;
    this.subMenu = null;
    this.reflectOpen();
    this.renderPanels();
  }

  /** Closes the panel and resets the sub-page. */
  close(): void {
    this.open = false;
    this.subMenu = null;
    this.reflectOpen();
    this.renderPanels();
  }

  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.playbackRate = state.playbackRate;
    this.playbackQuality = state.playbackQuality;
    this.activeCaption = state.activeCaption ?? null;
    this.renderPanels();
  }

  private resolveI18n(): MobileSettingsI18n {
    // Resolve the FULL localized dictionary from the `language` field (parity with the other i18n
    // elements), then layer explicit overrides on top — the Skin passes `{ language }`, so without
    // this the mobile panel labels (Quality/Speed/Captions/Off) would always render English.
    const language = typeof this._i18n?.language === 'string' ? this._i18n.language : undefined;
    const base = language ? getTranslations(language) : en;
    return { ...(base as MobileSettingsI18n), ...(this._i18n ?? {}) };
  }

  private reflectOpen(): void {
    if (this.open) {
      this.setAttribute('data-settings-open', 'true');
    } else {
      this.removeAttribute('data-settings-open');
    }
    if (this.subMenu !== null) {
      this.setAttribute('data-subpage', this.subMenu);
    } else {
      this.removeAttribute('data-subpage');
    }
  }

  /** Current value label shown on a switch card (parity with the original values). */
  private currentValueLabel(category: MobileSettingsCategory, i18n: MobileSettingsI18n): string {
    if (category === 'speed') {
      return buildSettingsLabel({ label: 'speed', value: String(this.playbackRate), i18n });
    }
    if (category === 'quality') {
      const q = this.playbackQuality ?? 0;
      return buildSettingsLabel({ label: 'quality', value: String(q), i18n });
    }
    // captions
    if (this.activeCaption === null) {
      return i18n.off ?? 'Off';
    }
    const track = this._captions.find((c) => c.language === this.activeCaption);
    return track?.label ?? i18n.off ?? 'Off';
  }

  /** The categories shown on the main page given the current inputs + gating. */
  private visibleCategories(): MobileSettingsCategory[] {
    const categories: MobileSettingsCategory[] = [];
    if (this._qualityOptions.length > 0) {
      categories.push('quality');
    }
    if (!this._adMode && !this._live) {
      categories.push('speed'); // speed dropped during ads and on live streams (parity)
    }
    if (this._captions.length > 0) {
      categories.push('captions');
    }
    return categories;
  }

  protected render(): void {
    if (this.panel !== null) {
      return;
    }

    const panel = document.createElement('div');
    panel.setAttribute('part', 'mobile-settings-panel');

    // Header: back (or gear) + title + close.
    const header = document.createElement('div');
    header.setAttribute('part', 'mobile-settings-header');

    const back = document.createElement('button');
    back.setAttribute('type', 'button');
    back.setAttribute('part', 'mobile-settings-back');
    const backIcon = document.createElement('span');
    backIcon.className = 'icon';
    backIcon.innerHTML = renderSvgFromDescriptor(mobileBackIcon);
    const gearIcon = document.createElement('span');
    gearIcon.className = 'icon';
    gearIcon.innerHTML = renderSvgFromDescriptor(mobileSettingsGearIcon);
    back.appendChild(gearIcon);
    back.appendChild(backIcon);
    const onBack = (): void => {
      if (this.subMenu !== null) {
        this.subMenu = null;
        this.reflectOpen();
        this.renderPanels();
      }
    };
    back.addEventListener('click', onBack);
    this.addDisposer(() => back.removeEventListener('click', onBack));

    const titleEl = document.createElement('span');
    titleEl.setAttribute('part', 'mobile-settings-title');

    const close = document.createElement('button');
    close.setAttribute('type', 'button');
    close.setAttribute('part', 'mobile-settings-close');
    close.setAttribute('aria-label', 'Close');
    close.textContent = '\u2715'; // ✕
    const onClose = (): void => this.close();
    close.addEventListener('click', onClose);
    this.addDisposer(() => close.removeEventListener('click', onClose));

    header.appendChild(back);
    header.appendChild(titleEl);
    header.appendChild(close);

    // Main page: switch grid.
    const mainPage = document.createElement('div');
    mainPage.setAttribute('part', 'mobile-settings-mainpage');
    const grid = document.createElement('div');
    grid.setAttribute('part', 'mobile-settings-grid');
    mainPage.appendChild(grid);

    // Sub page: option list.
    const subPage = document.createElement('div');
    subPage.setAttribute('part', 'mobile-settings-subpage');
    const subContent = document.createElement('div');
    subContent.setAttribute('part', 'mobile-settings-subcontent');
    subPage.appendChild(subContent);

    panel.appendChild(header);
    panel.appendChild(mainPage);
    panel.appendChild(subPage);

    this.panel = panel;
    this.grid = grid;
    this.subContent = subContent;
    this.titleEl = titleEl;
    this.backButton = back;

    this.root.appendChild(panel);
    this.reflectOpen();
    this.renderPanels();
  }

  private rebuild(): void {
    if (this.panel === null) {
      return;
    }
    this.renderPanels();
  }

  private renderPanels(): void {
    if (this.grid === null || this.subContent === null || this.titleEl === null) {
      return;
    }
    const i18n = this.resolveI18n();

    // Header title reflects the open sub-page or "Settings"; toggle the back-vs-gear glyph.
    if (this.subMenu === 'quality') {
      this.titleEl.textContent = i18n.quality ?? 'Quality';
    } else if (this.subMenu === 'speed') {
      this.titleEl.textContent = i18n.speed ?? 'Speed';
    } else if (this.subMenu === 'captions') {
      this.titleEl.textContent = i18n.captions ?? 'Captions';
    } else {
      this.titleEl.textContent = i18n.settings ?? 'Settings';
    }
    if (this.backButton !== null) {
      this.backButton.setAttribute('data-mode', this.subMenu !== null ? 'back' : 'gear');
    }

    // Main-page switch cards.
    this.grid.replaceChildren();
    const iconFor: Record<MobileSettingsCategory, string> = {
      quality: renderSvgFromDescriptor(mobileSettingsGearIcon),
      speed: renderSvgFromDescriptor(mobileSpeedIcon),
      captions: renderSvgFromDescriptor(mobileCaptionsIcon),
    };
    const labelFor = (c: MobileSettingsCategory): string =>
      c === 'quality'
        ? (i18n.quality ?? 'Quality')
        : c === 'speed'
          ? (i18n.speed ?? 'Speed')
          : (i18n.captions ?? 'Captions');

    for (const category of this.visibleCategories()) {
      const card = document.createElement('button');
      card.setAttribute('type', 'button');
      card.setAttribute('part', 'mobile-settings-switch');
      card.setAttribute('data-category', category);

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.setAttribute('part', 'mobile-settings-switch-icon');
      icon.innerHTML = iconFor[category];

      const label = document.createElement('span');
      label.setAttribute('part', 'mobile-settings-switch-label');
      label.textContent = labelFor(category);

      const value = document.createElement('span');
      value.setAttribute('part', 'mobile-settings-switch-value');
      value.textContent = this.currentValueLabel(category, i18n);

      card.appendChild(icon);
      card.appendChild(label);
      card.appendChild(value);

      const onOpen = (): void => {
        this.subMenu = category;
        this.reflectOpen();
        this.renderPanels();
      };
      card.addEventListener('click', onOpen);
      this.addDisposer(() => card.removeEventListener('click', onOpen));
      this.grid.appendChild(card);
    }

    // Sub-page options for the open category.
    this.subContent.replaceChildren();
    if (this.subMenu !== null) {
      const options = this.optionsFor(this.subMenu, i18n);
      for (const opt of options) {
        const item = document.createElement('button');
        item.setAttribute('type', 'button');
        item.setAttribute('part', 'mobile-settings-option');
        item.setAttribute('data-value', opt.value);
        item.textContent = opt.label;
        if (opt.active) {
          item.setAttribute('data-active', 'true');
        }
        const onSelect = (): void => this.selectOption(this.subMenu as MobileSettingsCategory, opt.value);
        item.addEventListener('click', onSelect);
        this.addDisposer(() => item.removeEventListener('click', onSelect));
        this.subContent.appendChild(item);
      }
    }
  }

  /** Builds the option rows (label/value/active) for a category. */
  private optionsFor(
    category: MobileSettingsCategory,
    i18n: MobileSettingsI18n,
  ): Array<{ label: string; value: string; active: boolean }> {
    if (category === 'speed') {
      return SPEED_VALUES.map((value) => ({
        label: buildSettingsLabel({ label: 'speed', value, i18n }),
        value,
        active: value === String(this.playbackRate),
      }));
    }
    if (category === 'quality') {
      const active = String(this.playbackQuality ?? 0);
      const rows = this._qualityOptions.map((q) => ({ label: q.label, value: q.value, active: q.value === active }));
      rows.push({ label: i18n.auto ?? 'Auto', value: '0', active: active === '0' });
      return rows;
    }
    // captions: Off + each track.
    const rows = [{ label: i18n.off ?? 'Off', value: 'off', active: this.activeCaption === null }];
    for (const track of this._captions) {
      rows.push({ label: track.label, value: track.language, active: this.activeCaption === track.language });
    }
    return rows;
  }

  /** Emits the request for a chosen option, then closes the panel (parity: pick + dismiss). */
  private selectOption(category: MobileSettingsCategory, value: string): void {
    if (category === 'speed') {
      this.dispatchRequest('playerstack-rate-request', { rate: Number(value) });
    } else if (category === 'quality') {
      this.dispatchRequest('playerstack-quality-request', { value });
    } else {
      this.dispatchRequest('playerstack-caption-request', { value: value === 'off' ? null : value });
    }
    this.close();
  }
}
