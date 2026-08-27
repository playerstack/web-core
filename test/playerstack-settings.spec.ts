import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-settings` — the settings control UI_Element (Req 3.3, 5.1, 5.2, 5.3,
 * 17.5). It verifies the Markup_Contract (`part="settings-button"` + `part="menu"` +
 * `part="submenu"`), store→`data-quality` propagation (Req 3.3), and the request-event wiring:
 * navigating the gear → Speed menu-item → a speed submenu-item emits `playerstack-rate-request`
 * with the selected rate (Req 2.1).
 *
 * The menu structure is built from the shared `buildSettingsOptions`, so the top-level rows are
 * queried by `[part="menu-item"]` (Speed is always present) and the speed choices by
 * `[part="submenu-item"]` with their `data-value`.
 */
registerPlayerstackElements();

/** Creates a connected controller host and a settings child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-settings');
  host.appendChild(el);
  return { host, el };
}

/** Opens the menu (gear click) and returns the Speed top-level menu-item button. */
function openSpeedMenu(el: HTMLElement): HTMLButtonElement {
  const root = el;
  const gear = root.querySelector('[part="settings-button"]') as HTMLButtonElement;
  gear.click();
  const items = Array.from(root.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
  const speed = items.find((item) => item.getAttribute('data-category') === 'speed');
  return speed as HTMLButtonElement;
}

describe('playerstack-settings', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract (Req 5.1, 5.2, 5.3)', () => {
    it('renders part="settings-button", part="menu" and part="submenu"', () => {
      const { el } = mount();
      const root = el;

      const button = root.querySelector('[part="settings-button"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('type')).toBe('button');
      expect(root.querySelector('.icon-settings')).not.toBeNull();
      expect(root.querySelector('[part="menu"]')).not.toBeNull();
      expect(root.querySelector('[part="submenu"]')).not.toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('open state + store→data-* propagation (Req 3.3)', () => {
    it('reflects data-open on the host when the menu toggles', () => {
      const { el } = mount();
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;

      gear.click();
      expect(el.getAttribute('data-open')).toBe('true');

      gear.click();
      expect(el.getAttribute('data-open')).toBeNull();
    });

    it('marks the active speed submenu-item from the store playbackRate', () => {
      const { host, el } = mount();
      host.store.set({ playbackRate: 2 });

      const speed = openSpeedMenu(el);
      speed.click();

      const root = el;
      const active = root.querySelector('[part="submenu-item"][data-active="true"]') as HTMLElement;
      expect(active).not.toBeNull();
      expect(active.getAttribute('data-value')).toBe('2');
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('emits playerstack-rate-request with the selected rate on a speed choice', () => {
      const { el } = mount();

      const speed = openSpeedMenu(el);
      speed.click();

      const root = el;
      const items = Array.from(root.querySelectorAll('[part="submenu-item"]')) as HTMLButtonElement[];
      const choice = items.find((item) => item.getAttribute('data-value') === '2') as HTMLButtonElement;
      expect(choice).not.toBeUndefined();

      const received: Array<CustomEvent<{ rate: number }>> = [];
      document.addEventListener('playerstack-rate-request', (e) => received.push(e as CustomEvent<{ rate: number }>));

      choice.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.rate).toBe(2);
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-quality-request with the selected value on a quality choice', () => {
      const { el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string }> }).qualityOptions = [
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
      ];

      const root = el;
      const gear = root.querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const menuItems = Array.from(root.querySelectorAll('[part="menu-item"]')) as HTMLButtonElement[];
      const quality = menuItems.find((item) => item.getAttribute('data-category') === 'quality') as HTMLButtonElement;
      expect(quality).not.toBeUndefined();
      quality.click();

      const choices = Array.from(root.querySelectorAll('[part="submenu-item"]')) as HTMLButtonElement[];
      const choice = choices.find((item) => item.getAttribute('data-value') === '720') as HTMLButtonElement;
      expect(choice).not.toBeUndefined();

      const received: Array<CustomEvent<{ value: string }>> = [];
      document.addEventListener('playerstack-quality-request', (e) =>
        received.push(e as CustomEvent<{ value: string }>),
      );

      choice.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.value).toBe('720');
      expect(received[0]?.composed).toBe(true);
      // Selecting closes the panel.
      expect(el.getAttribute('data-open')).toBeNull();
    });

    it('marks the active quality submenu-item from the store playbackQuality', () => {
      const { host, el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string }> }).qualityOptions = [
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
      ];
      host.store.set({ playbackQuality: 720 });

      const root = el;
      const gear = root.querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const quality = Array.from(root.querySelectorAll('[part="menu-item"]')).find(
        (item) => (item as HTMLElement).getAttribute('data-category') === 'quality',
      ) as HTMLButtonElement;
      quality.click();

      const active = root.querySelector('[part="submenu-item"][data-active="true"]') as HTMLElement;
      expect(active).not.toBeNull();
      expect(active.getAttribute('data-value')).toBe('720');
    });
  });

  describe('ad mode (Req parity: settings gating during ads)', () => {
    // Regression: with no quality options, ad mode drops the Speed category too (buildSettingsOptions
    // `if (!live && !adMode)`), leaving ZERO options — the host reflects `data-empty` so the Style_Layer
    // hides the whole settings control (parity with the original `settingsOptions.length === 0 -> null`).
    it('reflects data-empty when ad mode leaves no options (no qualities)', () => {
      const { el } = mount();
      expect(el.getAttribute('data-empty')).toBeNull();

      (el as unknown as { adMode: boolean }).adMode = true;
      expect(el.getAttribute('data-empty')).toBe('true');
      expect((el as unknown as { adMode: boolean }).adMode).toBe(true);

      // The main menu has no rows while empty.
      const items = (el).querySelectorAll('[part="menu-item"]');
      expect(items).toHaveLength(0);
    });

    // Regression: speed can NOT be changed during an ad — the Speed category must be absent even
    // when quality options exist, so only Quality remains and no `data-category="speed"` row shows.
    it('drops the Speed category in ad mode but keeps Quality (speed not changeable during ads)', () => {
      const { el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string }> }).qualityOptions = [
        { label: '1080p', value: '1080' },
      ];
      (el as unknown as { adMode: boolean }).adMode = true;

      // Not empty (Quality remains), so the control stays visible.
      expect(el.getAttribute('data-empty')).toBeNull();

      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const categories = Array.from((el).querySelectorAll('[part="menu-item"]')).map((item) =>
        (item as HTMLElement).getAttribute('data-category'),
      );
      expect(categories).toContain('quality');
      expect(categories).not.toContain('speed');
    });

    // Turning ad mode off restores the Speed category and clears the empty flag.
    it('restores the Speed category and clears data-empty when ad mode ends', () => {
      const { el } = mount();
      (el as unknown as { adMode: boolean }).adMode = true;
      expect(el.getAttribute('data-empty')).toBe('true');

      (el as unknown as { adMode: boolean }).adMode = false;
      expect(el.getAttribute('data-empty')).toBeNull();

      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const categories = Array.from((el).querySelectorAll('[part="menu-item"]')).map((item) =>
        (item as HTMLElement).getAttribute('data-category'),
      );
      expect(categories).toContain('speed');
    });
  });

  describe('live mode (Req parity: settings gating on live streams)', () => {
    // On a live stream, playback speed is not applicable, so the Speed category is dropped
    // (buildSettingsOptions `if (!live && !adMode)`). With no quality/caption options that leaves
    // ZERO options -> the host reflects `data-empty` and the Style_Layer hides the whole control
    // (parity with the original `useSettingsOptions({ live })` + `length === 0 -> null`).
    it('reflects data-empty on a live stream with no qualities or captions', () => {
      const { el } = mount();
      expect(el.getAttribute('data-empty')).toBeNull();

      (el as unknown as { live: boolean }).live = true;
      expect(el.getAttribute('data-empty')).toBe('true');
      expect((el).querySelectorAll('[part="menu-item"]')).toHaveLength(0);
    });

    it('drops the Speed category on live but keeps Quality when qualities exist', () => {
      const { el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string }> }).qualityOptions = [
        { label: '1080p', value: '1080' },
      ];
      (el as unknown as { live: boolean }).live = true;

      expect(el.getAttribute('data-empty')).toBeNull();
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const categories = Array.from((el).querySelectorAll('[part="menu-item"]')).map((item) =>
        (item as HTMLElement).getAttribute('data-category'),
      );
      expect(categories).toContain('quality');
      expect(categories).not.toContain('speed');
    });

    it('restores the Speed category and clears data-empty when live ends', () => {
      const { el } = mount();
      (el as unknown as { live: boolean }).live = true;
      expect(el.getAttribute('data-empty')).toBe('true');

      (el as unknown as { live: boolean }).live = false;
      expect(el.getAttribute('data-empty')).toBeNull();
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const categories = Array.from((el).querySelectorAll('[part="menu-item"]')).map((item) =>
        (item as HTMLElement).getAttribute('data-category'),
      );
      expect(categories).toContain('speed');
    });
  });

  describe('main row layout — title + current value + chevron', () => {
    it('renders a title, current value, and chevron arrow in each main menu row', () => {
      const { el } = mount();
      const root = el;
      const gear = root.querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();

      const speedItem = root.querySelector('[part="menu-item"][data-category="speed"]') as HTMLElement;
      const title = speedItem.querySelector('[part="menu-item-title"]') as HTMLElement;
      const value = speedItem.querySelector('[part="menu-item-value"]') as HTMLElement;
      const arrow = speedItem.querySelector('[part="menu-item-arrow"]') as HTMLElement;

      expect(title).not.toBeNull();
      expect(title.textContent).toBe('Speed');
      expect(value).not.toBeNull();
      expect(value.textContent).toBe('Normal'); // playbackRate default 1 -> "Normal"
      expect(arrow).not.toBeNull();
      expect(arrow.querySelector('svg')).not.toBeNull();
    });

    it('shows the store-driven quality label in the quality main row', () => {
      const { host, el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string }> }).qualityOptions = [
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
      ];
      host.store.set({ playbackQuality: 720 });

      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const qualityItem = (el).querySelector('[part="menu-item"][data-category="quality"]') as HTMLElement;
      const value = qualityItem.querySelector('[part="menu-item-value"]') as HTMLElement;
      expect(value.textContent).toBe('720p');
    });
  });

  describe('submenu navigation — header with back button', () => {
    it('renders a submenu header with back arrow and category title', () => {
      const { el } = mount();
      const speed = openSpeedMenu(el);
      speed.click();

      const header = (el).querySelector('[part="submenu-header"]') as HTMLElement;
      expect(header).not.toBeNull();

      const back = header.querySelector('[part="submenu-back"]') as HTMLElement;
      expect(back).not.toBeNull();
      expect(back.querySelector('svg')).not.toBeNull();
      // Title text inside the back button.
      expect(back.textContent).toContain('Speed');
    });

    it('reflects data-submenu on the host when a category is open', () => {
      const { el } = mount();
      expect(el.getAttribute('data-submenu')).toBeNull();

      const speed = openSpeedMenu(el);
      speed.click();
      expect(el.getAttribute('data-submenu')).toBe('speed');
    });

    it('clicking back returns to the main menu (clears data-submenu)', () => {
      const { el } = mount();
      const speed = openSpeedMenu(el);
      speed.click();
      expect(el.getAttribute('data-submenu')).toBe('speed');

      const back = (el).querySelector('[part="submenu-back"]') as HTMLButtonElement;
      back.click();
      expect(el.getAttribute('data-submenu')).toBeNull();
      expect(el.getAttribute('data-open')).toBe('true'); // still open
    });
  });

  describe('submenu slide-in reveal (data-show)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('sets data-show on the submenu after 100ms', () => {
      const { el } = mount();
      const speed = openSpeedMenu(el);
      speed.click();

      const submenu = (el).querySelector('[part="submenu"]') as HTMLElement;
      // Before the timer fires, no data-show.
      expect(submenu.getAttribute('data-show')).toBeNull();

      jest.advanceTimersByTime(100);
      expect(submenu.getAttribute('data-show')).toBe('true');
    });
  });

  describe('HD badge on gear button (data-fullhd)', () => {
    it('reflects data-fullhd when the active quality is full-HD', () => {
      const { host, el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string; isFullHD?: boolean }> }).qualityOptions =
        [
          { label: '1080p', value: '1080', isFullHD: true },
          { label: '720p', value: '720' },
        ];
      host.store.set({ playbackQuality: 1080 });
      expect(el.getAttribute('data-fullhd')).toBe('true');
    });

    it('does NOT reflect data-fullhd for non-HD qualities', () => {
      const { host, el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string; isFullHD?: boolean }> }).qualityOptions =
        [
          { label: '1080p', value: '1080', isFullHD: true },
          { label: '720p', value: '720' },
        ];
      host.store.set({ playbackQuality: 720 });
      expect(el.getAttribute('data-fullhd')).toBeNull();
    });
  });

  describe('HD sub-badge on submenu options', () => {
    it('renders an hd-badge part for full-HD quality options in the submenu', () => {
      const { el } = mount();
      (el as unknown as { qualityOptions: Array<{ label: string; value: string; isFullHD?: boolean }> }).qualityOptions =
        [
          { label: '1080p', value: '1080', isFullHD: true },
          { label: '720p', value: '720' },
        ];

      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const quality = Array.from((el).querySelectorAll('[part="menu-item"]')).find(
        (item) => (item as HTMLElement).getAttribute('data-category') === 'quality',
      ) as HTMLButtonElement;
      quality.click();

      const items = Array.from((el).querySelectorAll('[part="submenu-item"]'));
      const hdItem = items.find((item) => (item as HTMLElement).getAttribute('data-value') === '1080') as HTMLElement;
      const badge = hdItem?.querySelector('[part="hd-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('HD');

      // 720p should NOT have the badge.
      const nonHDItem = items.find((item) => (item as HTMLElement).getAttribute('data-value') === '720') as HTMLElement;
      expect(nonHDItem?.querySelector('[part="hd-badge"]')).toBeNull();
    });
  });

  describe('inputs (qualityOptions / i18n) accessors', () => {
    it('exposes and normalizes qualityOptions via the getter/setter', () => {
      const { el } = mount();
      const opts = [{ label: '720p', value: '720' }];
      (el as unknown as { qualityOptions: typeof opts }).qualityOptions = opts;
      expect((el as unknown as { qualityOptions: typeof opts }).qualityOptions).toEqual(opts);

      // A non-array assignment is normalized to an empty list.
      (el as unknown as { qualityOptions: unknown }).qualityOptions = null;
      expect((el as unknown as { qualityOptions: typeof opts }).qualityOptions).toEqual([]);
    });

    it('applies a custom i18n bag to the menu labels and exposes it via the getter', () => {
      const { el } = mount();
      const i18n = { speed: 'Velocidad', quality: 'Calidad', auto: 'Auto', normal: 'Normal' };
      (el as unknown as { i18n: typeof i18n | null }).i18n = i18n;
      expect((el as unknown as { i18n: typeof i18n | null }).i18n).toBe(i18n);

      const root = el;
      const gear = root.querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const speedItem = Array.from(root.querySelectorAll('[part="menu-item"]')).find(
        (item) => (item as HTMLElement).getAttribute('data-category') === 'speed',
      ) as HTMLElement;
      // The main row now holds a title span + a current-value span + a chevron; assert on the
      // dedicated title part rather than the row's aggregate textContent.
      const speedTitle = speedItem.querySelector('[part="menu-item-title"]') as HTMLElement;
      expect(speedTitle.textContent).toBe('Velocidad');

      // Resetting to null restores the English default label.
      (el as unknown as { i18n: typeof i18n | null }).i18n = null;
      expect((el as unknown as { i18n: typeof i18n | null }).i18n).toBeNull();
    });

    it('resolves the FULL localized dictionary from the i18n `language` field', () => {
      const { el } = mount();
      // The Skin passes only `{ language }`; the element must resolve the full es dictionary so
      // the menu labels localize (parity with the original `useAppSelector().i18n`).
      (el as unknown as { i18n: { language: string } }).i18n = { language: 'es' };
      const root = el;
      (root.querySelector('[part="settings-button"]') as HTMLButtonElement).click();
      const speedTitle = root.querySelector(
        '[part="menu-item"][data-category="speed"] [part="menu-item-title"]',
      ) as HTMLElement;
      expect(speedTitle.textContent).toBe('Velocidad');
    });
  });

  // ── Captions category + caption STYLE "Options" panel (parity with the original desktop
  // settings Captions entry + `CaptionOptions`). Feeds tracks/activeCaption/captionStyle and
  // asserts the language selection + style requests + navigation.
  describe('captions category (parity: desktop settings Captions)', () => {
    const TRACKS = [
      { label: 'English', language: 'en', src: 'en.vtt' },
      { label: 'Español', language: 'es', src: 'es.vtt' },
    ];

    /** Sets tracks and opens the Captions submenu; returns the settings root. */
    function openCaptions(el: HTMLElement): HTMLElement {
      (el as unknown as { captions: typeof TRACKS }).captions = TRACKS;
      const gear = el.querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const captions = Array.from(el.querySelectorAll('[part="menu-item"]')).find(
        (item) => (item as HTMLElement).getAttribute('data-category') === 'captions',
      ) as HTMLButtonElement;
      captions.click();
      return el;
    }

    it('renders a Captions main row when tracks are provided and shows the current value', () => {
      const { el } = mount();
      (el as unknown as { captions: typeof TRACKS }).captions = TRACKS;
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const row = (el).querySelector('[part="menu-item"][data-category="captions"]') as HTMLElement;
      expect(row).not.toBeNull();
      const value = row.querySelector('[part="menu-item-value"]') as HTMLElement;
      // No active caption -> "Off".
      expect(value.textContent).toBe('Off');
    });

    it('shows the active track label in the Captions main row', () => {
      const { el } = mount();
      (el as unknown as { captions: typeof TRACKS; activeCaption: string }).captions = TRACKS;
      (el as unknown as { activeCaption: string }).activeCaption = 'es';
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const row = (el).querySelector('[part="menu-item"][data-category="captions"]') as HTMLElement;
      expect(row.querySelector('[part="menu-item-value"]')?.textContent).toBe('Español');
    });

    it('renders an Off row plus one row per track in the Captions submenu', () => {
      const { el } = mount();
      openCaptions(el);
      const items = Array.from((el).querySelectorAll('[part="submenu-item"]')) as HTMLElement[];
      const labels = items.map((i) => i.textContent);
      expect(labels).toEqual(['Off', 'English', 'Español']);
    });

    it('emits playerstack-caption-request with the track language on selection', () => {
      const { el } = mount();
      openCaptions(el);

      const received: Array<CustomEvent<{ value: string | null }>> = [];
      document.addEventListener('playerstack-caption-request', (e) =>
        received.push(e as CustomEvent<{ value: string | null }>),
      );

      const es = Array.from((el).querySelectorAll('[part="submenu-item"]')).find(
        (i) => (i as HTMLElement).getAttribute('data-value') === 'es',
      ) as HTMLButtonElement;
      es.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.value).toBe('es');
      expect(received[0]?.composed).toBe(true);
    });

    it('emits playerstack-caption-request with null when Off is selected', () => {
      const { el } = mount();
      openCaptions(el);

      const received: Array<CustomEvent<{ value: string | null }>> = [];
      document.addEventListener('playerstack-caption-request', (e) =>
        received.push(e as CustomEvent<{ value: string | null }>),
      );

      const off = Array.from((el).querySelectorAll('[part="submenu-item"]')).find(
        (i) => (i as HTMLElement).getAttribute('data-value') === 'off',
      ) as HTMLButtonElement;
      off.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.value).toBeNull();
    });

    it('mirrors the active caption from the store (CC quick-toggle sync)', () => {
      const { host, el } = mount();
      (el as unknown as { captions: typeof TRACKS }).captions = TRACKS;
      host.store.set({ activeCaption: 'en' });
      const gear = (el).querySelector('[part="settings-button"]') as HTMLButtonElement;
      gear.click();
      const row = (el).querySelector('[part="menu-item"][data-category="captions"]') as HTMLElement;
      expect(row.querySelector('[part="menu-item-value"]')?.textContent).toBe('English');
    });

    it('marks the active caption submenu-item (Off when none active)', () => {
      const { el } = mount();
      openCaptions(el);
      const active = (el).querySelector('[part="submenu-item"][data-active="true"]') as HTMLElement;
      expect(active?.getAttribute('data-value')).toBe('off');
    });
  });

  describe('caption STYLE "Options" panel (parity: CaptionOptions)', () => {
    const TRACKS = [{ label: 'English', language: 'en', src: 'en.vtt' }];

    /** Opens the Captions submenu then the style "Options" panel; returns the root. */
    function openOptions(el: HTMLElement): HTMLElement {
      (el as unknown as { captions: typeof TRACKS }).captions = TRACKS;
      (el.querySelector('[part="settings-button"]') as HTMLButtonElement).click();
      (
        Array.from(el.querySelectorAll('[part="menu-item"]')).find(
          (i) => (i as HTMLElement).getAttribute('data-category') === 'captions',
        ) as HTMLButtonElement
      ).click();
      (el.querySelector('[part="submenu-options"]') as HTMLButtonElement).click();
      return el;
    }

    it('shows an "Options" affordance in the Captions submenu header', () => {
      const { el } = mount();
      (el as unknown as { captions: typeof TRACKS }).captions = TRACKS;
      (el.querySelector('[part="settings-button"]') as HTMLButtonElement).click();
      (
        Array.from(el.querySelectorAll('[part="menu-item"]')).find(
          (i) => (i as HTMLElement).getAttribute('data-category') === 'captions',
        ) as HTMLButtonElement
      ).click();
      const link = el.querySelector('[part="submenu-options"]') as HTMLElement;
      expect(link).not.toBeNull();
      expect(link.textContent).toBe('Options');
    });

    it('opens the caption-options panel (reflects data-caption-options) with 9 style rows + Reset', () => {
      const { el } = mount();
      openOptions(el);
      expect(el.getAttribute('data-caption-options')).toBe('true');
      const rows = Array.from(el.querySelectorAll('[part="caption-options-item"]')) as HTMLElement[];
      // 9 style properties + Reset.
      expect(rows).toHaveLength(10);
      expect(rows[rows.length - 1]?.getAttribute('data-key')).toBe('reset');
    });

    it('shows each style property current value label', () => {
      const { el } = mount();
      openOptions(el);
      const fontColor = el.querySelector('[part="caption-options-item"][data-key="fontColor"]') as HTMLElement;
      const value = fontColor.querySelector('[part="caption-options-value"]') as HTMLElement;
      // Default fontColor #ffffff -> "White".
      expect(value.textContent).toContain('White');
    });

    it('drills into a style property and emits playerstack-caption-style-request on value select', () => {
      const { el } = mount();
      openOptions(el);

      // Drill into Font color.
      (el.querySelector('[part="caption-options-item"][data-key="fontColor"]') as HTMLButtonElement).click();

      const received: Array<CustomEvent<{ style: { fontColor: string } }>> = [];
      document.addEventListener('playerstack-caption-style-request', (e) =>
        received.push(e as CustomEvent<{ style: { fontColor: string } }>),
      );

      // Pick Yellow (#ffff00).
      const yellow = Array.from(el.querySelectorAll('[part="submenu-item"]')).find(
        (i) => (i as HTMLElement).getAttribute('data-value') === '#ffff00',
      ) as HTMLButtonElement;
      yellow.click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.style.fontColor).toBe('#ffff00');
      expect(received[0]?.composed).toBe(true);
    });

    it('Reset emits the default caption style', () => {
      const { el } = mount();
      // Seed a non-default style so Reset is observable.
      (el as unknown as { captionStyle: { fontColor: string } }).captionStyle = { fontColor: '#ff0000' } as never;
      openOptions(el);

      const received: Array<CustomEvent<{ style: { fontColor: string } }>> = [];
      document.addEventListener('playerstack-caption-style-request', (e) =>
        received.push(e as CustomEvent<{ style: { fontColor: string } }>),
      );

      (el.querySelector('[part="caption-options-item"][data-key="reset"]') as HTMLButtonElement).click();

      expect(received).toHaveLength(1);
      // Default fontColor is white.
      expect(received[0]?.detail.style.fontColor).toBe('#ffffff');
    });

    it('back from a style property returns to the style list; back again closes the panel', () => {
      const { el } = mount();
      openOptions(el);

      // Drill into a property.
      (el.querySelector('[part="caption-options-item"][data-key="fontSize"]') as HTMLButtonElement).click();
      // A value list is shown (submenu-items inside the caption-options panel).
      expect(el.querySelector('[part="caption-options"] [part="submenu-item"]')).not.toBeNull();

      // Back -> style list again.
      (el.querySelector('[part="caption-options"] [part="submenu-back"]') as HTMLButtonElement).click();
      expect(el.querySelectorAll('[part="caption-options-item"]').length).toBe(10);

      // Back -> closes the style panel (returns to the Captions submenu).
      (el.querySelector('[part="caption-options"] [part="submenu-back"]') as HTMLButtonElement).click();
      expect(el.getAttribute('data-caption-options')).toBeNull();
    });

    it('closing the settings menu clears the caption-options panel', () => {
      const { el } = mount();
      openOptions(el);
      expect(el.getAttribute('data-caption-options')).toBe('true');
      // Toggle the gear to close.
      (el.querySelector('[part="settings-button"]') as HTMLButtonElement).click();
      expect(el.getAttribute('data-caption-options')).toBeNull();
    });
  });
});
