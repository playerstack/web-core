import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { registerPlayerstackElements } from '@ui/register';

/**
 * Spec for `playerstack-context-menu` — the right-click loop / PiP / fullscreen menu
 * UI_Element (Req 3.3, 5.1, 5.2, 5.3, 17.5). It verifies the Markup_Contract (`part="context-
 * menu"` with `role="menu"` holding one `part="context-menu-item"` `role="menuitem"` per
 * action), the open/close behavior (`data-open` on right-click; Escape / document click
 * close), and request-event wiring: the loop item emits `playerstack-loop-request` with the
 * NEXT loop value, and the PiP/fullscreen items emit enter/exit based on store state (Req 2.1).
 */
registerPlayerstackElements();

/** Creates a connected controller host and a context-menu child wired to its store. */
function mount(): { host: PlayerstackMediaController; el: HTMLElement } {
  const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
  document.body.appendChild(host);
  const el = document.createElement('playerstack-context-menu');
  host.appendChild(el);
  return { host, el };
}

/** Returns the menu item button for a given action from the element's shadow root. */
function itemFor(el: HTMLElement, action: string): HTMLButtonElement {
  return (el).querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
}

describe('playerstack-context-menu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Markup_Contract + ARIA roles (Req 1.5, 5.1, 5.2, 5.3)', () => {
    it('renders part="context-menu" role=menu with a menuitem per action', () => {
      const { el } = mount();
      const root = el;

      const menu = root.querySelector('[part="context-menu"]');
      expect(menu).not.toBeNull();
      expect(menu?.getAttribute('role')).toBe('menu');

      // Parity: the original right-click menu offered only Loop + Picture in Picture.
      const items = root.querySelectorAll('[part="context-menu-item"]');
      expect(items).toHaveLength(2);
      items.forEach((item) => expect(item.getAttribute('role')).toBe('menuitem'));

      expect(itemFor(el, 'loop')).not.toBeNull();
      expect(itemFor(el, 'pip')).not.toBeNull();
      // No Fullscreen row (removed for parity with the original menu).
      expect(itemFor(el, 'fullscreen')).toBeNull();
    });

    it('matches the rendered shadow markup snapshot', () => {
      const { el } = mount();
      expect((el).innerHTML).toMatchSnapshot();
    });
  });

  describe('markup details (icons + checked marker)', () => {
    it('renders a leading icon + label on every item and a checked marker only on loop', () => {
      const { el } = mount();
      // Every item has an icon glyph and a label.
      (['loop', 'pip'] as const).forEach((action) => {
        const item = itemFor(el, action);
        expect(item.querySelector('[part="context-menu-icon"] svg')).not.toBeNull();
        expect(item.querySelector('[part="context-menu-label"]')).not.toBeNull();
      });
      // Only the loop item carries the checked marker (the checkable action).
      expect(itemFor(el, 'loop').querySelector('[part="context-menu-checked"]')).not.toBeNull();
      expect(itemFor(el, 'pip').querySelector('[part="context-menu-checked"]')).toBeNull();
    });

    it('renders icons before each label (loop + pip only)', () => {
      const { el } = mount();
      (['loop', 'pip'] as const).forEach((action) => {
        expect(itemFor(el, action).querySelector('[part="context-menu-icon"] svg')).not.toBeNull();
      });
    });
  });

  describe('open/close behavior (Req 3.3)', () => {
    it('opens on right-click (data-open) and closes on Escape', () => {
      const { el } = mount();

      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 20 }));
      expect(el.getAttribute('data-open')).toBe('true');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(el.getAttribute('data-open')).toBeNull();
    });

    it('opens when the right-click happens anywhere on the player stage (delegation)', () => {
      const { host, el } = mount();
      // A right-click on the controller stage (not on the menu element itself) must open the
      // menu, because the menu host is pointer-events:none and delegates to the stage.
      host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 40 }));
      expect(el.getAttribute('data-open')).toBe('true');
    });

    it('closes on a document click', () => {
      const { el } = mount();

      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 20 }));
      expect(el.getAttribute('data-open')).toBe('true');

      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.getAttribute('data-open')).toBeNull();
    });
  });

  describe('request-event wiring (Req 2.1)', () => {
    it('loop item emits playerstack-loop-request with the opposite of the store loop', () => {
      const { host, el } = mount();
      host.store.set({ loop: false });

      const received: Array<CustomEvent<{ loop: boolean }>> = [];
      document.addEventListener('playerstack-loop-request', (e) => received.push(e as CustomEvent<{ loop: boolean }>));

      itemFor(el, 'loop').click();

      expect(received).toHaveLength(1);
      expect(received[0]?.detail.loop).toBe(true);
    });

    it('pip item emits enter-pip when not in PiP and exit-pip when in PiP', () => {
      const { host, el } = mount();

      const enter: CustomEvent[] = [];
      const exit: CustomEvent[] = [];
      document.addEventListener('playerstack-enter-pip-request', (e) => enter.push(e as CustomEvent));
      document.addEventListener('playerstack-exit-pip-request', (e) => exit.push(e as CustomEvent));

      host.store.set({ isPIP: false });
      itemFor(el, 'pip').click();
      expect(enter).toHaveLength(1);
      expect(exit).toHaveLength(0);

      host.store.set({ isPIP: true });
      itemFor(el, 'pip').click();
      expect(exit).toHaveLength(1);
    });

  });

  describe('ad / live / pip gating (parity with menuItemsMemorized)', () => {
    it('drops the Loop row in ad mode (loop not toggleable during an ad)', () => {
      const { el } = mount();
      expect(itemFor(el, 'loop')).not.toBeNull();

      (el as unknown as { adMode: boolean }).adMode = true;
      expect(itemFor(el, 'loop')).toBeNull();
      // PiP stays.
      expect(itemFor(el, 'pip')).not.toBeNull();

      // Ending the ad restores Loop.
      (el as unknown as { adMode: boolean }).adMode = false;
      expect(itemFor(el, 'loop')).not.toBeNull();
    });

    it('drops the Loop row for live streams', () => {
      const { el } = mount();
      (el as unknown as { live: boolean }).live = true;
      expect(itemFor(el, 'loop')).toBeNull();
      expect(itemFor(el, 'pip')).not.toBeNull();
    });

    it('drops the PiP row when PiP is unavailable', () => {
      const { el } = mount();
      (el as unknown as { pipEnabled: boolean }).pipEnabled = false;
      expect(itemFor(el, 'pip')).toBeNull();
      expect(itemFor(el, 'loop')).not.toBeNull();
    });

    it('exposes the gating flags via getters', () => {
      const { el } = mount();
      const typed = el as unknown as { adMode: boolean; live: boolean; pipEnabled: boolean };
      typed.adMode = true;
      typed.live = true;
      typed.pipEnabled = false;
      expect(typed.adMode).toBe(true);
      expect(typed.live).toBe(true);
      expect(typed.pipEnabled).toBe(false);
    });
  });

  describe('i18n labels', () => {
    it('applies custom labels via the i18n setter and exposes them via the getter', () => {
      const { el } = mount();
      const i18n = { loop: 'Repetir', pip: 'Imagen en imagen', fullscreen: 'Pantalla completa' };
      (el as unknown as { i18n: typeof i18n | null }).i18n = i18n;

      expect((el as unknown as { i18n: typeof i18n | null }).i18n).toBe(i18n);
      const labelOf = (action: string): string =>
        itemFor(el, action).querySelector('[part="context-menu-label"]')?.textContent ?? '';
      expect(labelOf('loop')).toBe('Repetir');
      expect(labelOf('pip')).toBe('Imagen en imagen');

      // Resetting to null restores the English defaults.
      (el as unknown as { i18n: typeof i18n | null }).i18n = null;
      expect(labelOf('loop')).toBe('Loop');
    });
  });

  describe('active markers from store state present before connect', () => {
    it('marks items active from the store state resolved at render', () => {
      const host = document.createElement('playerstack-media-controller') as PlayerstackMediaController;
      document.body.appendChild(host);
      host.store.set({ loop: true, isPIP: true });

      const el = document.createElement('playerstack-context-menu');
      host.appendChild(el); // connect: render paints active markers from the resolved store state

      expect(itemFor(el, 'loop').getAttribute('data-active')).toBe('true');
      expect(itemFor(el, 'pip').getAttribute('data-active')).toBe('true');
    });
  });
});
