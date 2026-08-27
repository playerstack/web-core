/**
 * `playerstack-context-menu` — the right-click menu offering loop / Picture-in-Picture /
 * fullscreen actions (Req 1.4, 1.6, 3.3, 5.1, 5.3).
 *
 * As an interactive UI_Element it follows the Request/Response model: it NEVER touches the
 * media element, the Picture-in-Picture API, or the Fullscreen API directly. Selecting an
 * item only expresses intent via bubbling + composed request events that the
 * `MediaController` / a capable adapter fulfils (Req 2.1):
 *   - loop → `playerstack-loop-request` (`detail: { loop }`) — a custom, adapter-extensible
 *     event carrying the NEXT loop state, since the defined core request vocabulary has no
 *     loop entry.
 *   - PiP → `playerstack-enter-pip-request` / `playerstack-exit-pip-request` (matching
 *     `playerstack-pip-button`).
 *   - fullscreen → `playerstack-enter-fullscreen-request` /
 *     `playerstack-exit-fullscreen-request` (matching `playerstack-fullscreen-button`).
 *
 * WHY requests instead of mutating the DOM: dispatching requests keeps the element adapter-
 * extensible and consistent with the rest of the UI_Layer. `UIController` (the Core UI state
 * controller) only owns auto-hide/lock/settings visibility — it exposes NO loop/PiP/
 * fullscreen decision logic — so the current loop/PiP/fullscreen values are read from the
 * shared store, and the element decides "which request" from that state.
 *
 * The menu opens on `contextmenu` (right-click) at the pointer position and closes on any
 * document click, on `Escape`, or on the next `contextmenu`. Its open state is reflected as
 * `data-open` on the host (Req 3.3) so the Style_Layer can show/hide the menu through
 * `:host([data-open]) [part='context-menu']`. Each item mirrors its active state via
 * `data-active` so the Style_Layer can render the checked marker. Row visibility is gated by
 * `adMode`/`live` (loop) and `pipEnabled` (PiP) to match the original menu. All listeners are
 * registered with cleanup via `addDisposer`.
 */
import type {
  ContextMenuAction,
  ContextMenuDefaultLabels,
  ContextMenuI18n,
} from '@typings/ui/playerstack-context-menu.types';
import type { MediaStoreState } from '@typings/ui/media-store.types';
import { PlayerstackElement } from '@ui/playerstack-element';
import type { IconDescriptor } from '@typings/icons.types';
import { renderSvgFromDescriptor } from '@ui/icon-render';
import { inLoopIcon, pipIcon, checkedIcon } from '@icons/index';

/** Default English labels applied when the consumer provides no i18n override (Req 1.5). */
const DEFAULT_LABELS: ContextMenuDefaultLabels = {
  loop: 'Loop',
  pip: 'Picture in Picture',
};

/** The action rows the menu can render, in display order (parity: original menu = loop + pip). */
const ACTIONS: readonly ContextMenuAction[] = ['loop', 'pip'];

/** Per-action leading glyph descriptors (parity with the original ICON_MAP loop/pip). */
const ACTION_ICONS: Record<ContextMenuAction, IconDescriptor> = {
  loop: inLoopIcon,
  pip: pipIcon,
};

export class PlayerstackContextMenu extends PlayerstackElement {
  /**
   * Optional per-action label overrides; defaults to `null` so the English defaults apply.
   * Setting it re-renders the item labels so translations apply immediately.
   */
  private _i18n: ContextMenuI18n | null = null;

  /** Latest loop state mirrored from the store; decides the loop request payload + marker. */
  private loop = false;

  /** Latest PiP state mirrored from the store; decides the enter/exit PiP request + marker. */
  private pip = false;

  /**
   * Ad-mode flag (default `false`). When `true` the LOOP row is dropped — parity with the
   * original `if (!adMode && !live)` guard: loop can NOT be toggled during an ad.
   */
  private _adMode = false;

  /**
   * Live flag (default `false`). When `true` the LOOP row is dropped too (a live stream can not
   * loop) — parity with the original `!live` guard.
   */
  private _live = false;

  /**
   * Whether Picture-in-Picture is available (default `true`). When `false` the PiP row is
   * dropped — parity with the original `if (pictureInPictureEnabled)` guard.
   */
  private _pipEnabled = true;

  /** Whether the menu is currently open; reflected as `data-open` on the host (Req 3.3). */
  private open = false;

  /** The rendered menu container; kept so `render` stays idempotent across reconnects. */
  private menu: HTMLElement | null = null;

  /** The rendered action items keyed by action so store changes can re-mark active state. */
  private items: Partial<Record<ContextMenuAction, HTMLButtonElement>> = {};

  /**
   * Public setter for the minimal i18n label bag. Re-renders the item labels so translated
   * labels apply immediately; passing `null` restores the English defaults.
   */
  set i18n(value: ContextMenuI18n | null) {
    this._i18n = value;
    this.applyLabels();
  }

  get i18n(): ContextMenuI18n | null {
    return this._i18n;
  }

  /**
   * Ad-mode setter (default `false`). Re-renders the menu so the LOOP row drops/returns when an
   * ad starts/ends (parity: loop is unavailable during an ad).
   */
  set adMode(value: boolean) {
    this._adMode = Boolean(value);
    this.rebuild();
  }

  get adMode(): boolean {
    return this._adMode;
  }

  /** Live setter (default `false`). Re-renders so the LOOP row drops/returns for live streams. */
  set live(value: boolean) {
    this._live = Boolean(value);
    this.rebuild();
  }

  get live(): boolean {
    return this._live;
  }

  /**
   * PiP-availability setter (default `true`). Re-renders so the PiP row drops when PiP is not
   * supported (parity with the original `pictureInPictureEnabled` guard).
   */
  set pipEnabled(value: boolean) {
    this._pipEnabled = Boolean(value);
    this.rebuild();
  }

  get pipEnabled(): boolean {
    return this._pipEnabled;
  }

  /**
   * The actions actually shown given the current gating (parity with the original
   * `menuItemsMemorized`): LOOP only when NOT ad and NOT live; PiP only when PiP is available.
   */
  private visibleActions(): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    if (!this._adMode && !this._live) {
      actions.push('loop');
    }
    if (this._pipEnabled) {
      actions.push('pip');
    }
    return actions;
  }

  /**
   * Tracks the loop/PiP state this element cares about so each item's request decision and
   * active marker stay correct (Req 3.3). Only the fields needed are read, per the base class's
   * opt-in `onStoreChange` design.
   */
  override onStoreChange(state: Readonly<MediaStoreState>): void {
    this.loop = state.loop;
    this.pip = state.isPIP;
    this.reflectState({ loop: state.loop, pip: state.isPIP });
    this.markActiveItems();
  }

  /**
   * Resolves the label for an action: the consumer i18n override takes precedence, then the
   * English default. Returned as a plain string used as the item's text content.
   */
  private resolveLabel(action: ContextMenuAction): string {
    return this._i18n?.[action] ?? DEFAULT_LABELS[action];
  }

  /**
   * Opens the menu at the pointer position (Req 3.3). The `contextmenu` default (the browser's
   * native menu) is prevented so the player's menu takes over. Position is computed RELATIVE to
   * the player box (the `playerstack-media-controller` ancestor) and CLAMPED so the menu never
   * spills past the right/bottom edge — mirroring the original `handleContextMenu`, which used
   * the container rect and subtracted the menu size when it would overflow. The clamped x/y are
   * written as `--playerstack-context-menu-x/-y` custom properties the Style_Layer consumes.
   */
  private openAt(event: MouseEvent): void {
    event.preventDefault();

    // The clamping box is the player stage (this element is absolutely positioned to fill it).
    const stage = this.closest('playerstack-media-controller') ?? this;
    const rect = stage.getBoundingClientRect();
    let relativeX = event.clientX - rect.left;
    let relativeY = event.clientY - rect.top;

    // Measure the menu so we can flip it back inside the box when it would overflow. The menu
    // is rendered but hidden (display via data-open); read its size after making it measurable.
    // We set data-open first so the menu has layout, then measure + clamp.
    this.open = true;
    this.setAttribute('data-open', 'true');
    const menuWidth = this.menu?.offsetWidth ?? 0;
    const menuHeight = this.menu?.offsetHeight ?? 0;
    if (relativeX + menuWidth > rect.width) {
      relativeX = Math.max(0, relativeX - menuWidth);
    }
    if (relativeY + menuHeight > rect.height) {
      relativeY = Math.max(0, relativeY - menuHeight);
    }

    this.style.setProperty('--playerstack-context-menu-x', `${relativeX}px`);
    this.style.setProperty('--playerstack-context-menu-y', `${relativeY}px`);
  }

  /** Closes the menu and clears the reflected `data-open` state (Req 3.3). */
  private close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.removeAttribute('data-open');
  }

  /**
   * Emits the request for a selected action, reading the current state from the store to
   * decide the intent (Req 2.1), then closes the menu so the interaction reads as "pick and
   * dismiss". Loop toggles via a custom `playerstack-loop-request` carrying the NEXT loop
   * value; PiP/fullscreen emit the same enter/exit events their dedicated buttons use.
   */
  private selectAction(action: ContextMenuAction): void {
    if (action === 'loop') {
      this.dispatchRequest('playerstack-loop-request', { loop: !this.loop });
    } else {
      this.dispatchRequest(this.pip ? 'playerstack-exit-pip-request' : 'playerstack-enter-pip-request');
    }
    this.close();
  }

  /**
   * Builds the Markup_Contract: a `part="context-menu"` container (hidden by default via the
   * Style_Layer until `data-open`) holding one `part="context-menu-item"` `<button>` per
   * action. Nodes are created and APPENDED (never via `innerHTML`) so the adopted Style_Layer
   * — in the fallback path an injected `<style>` — is preserved. Right-click and document
   * click/Escape listeners are registered with matching disposers. A guard keeps `render`
   * idempotent across reconnects.
   */
  protected render(): void {
    if (this.menu !== null) {
      return;
    }

    const menu = document.createElement('div');
    menu.setAttribute('part', 'context-menu');
    menu.setAttribute('role', 'menu');

    this.menu = menu;
    // Append (never clobber) so the adopted Style_Layer / fallback `<style>` survives.
    this.root.appendChild(menu);

    // Build the initial item rows from the current gating.
    this.buildItems();

    // Open on right-click. The listener lives on the PLAYER STAGE (the controller ancestor),
    // NOT on this element: the context-menu host is `pointer-events:none` (so it never swallows
    // clicks over the video), which also means it can't receive `contextmenu` itself. Delegating
    // to the stage — which does receive pointer events over the whole player — restores the
    // right-click trigger exactly like the original `onContextMenu` on the player container.
    const stage = this.closest('playerstack-media-controller') ?? this;
    const onContextMenu = (event: Event): void => this.openAt(event as MouseEvent);
    stage.addEventListener('contextmenu', onContextMenu);
    this.addDisposer(() => stage.removeEventListener('contextmenu', onContextMenu));

    // A document click anywhere dismisses the menu (including clicks inside it, after the
    // item handler has already run and closed it — the guard in `close` makes that a no-op).
    const onDocumentClick = (): void => this.close();
    document.addEventListener('click', onDocumentClick);
    this.addDisposer(() => document.removeEventListener('click', onDocumentClick));

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    this.addDisposer(() => document.removeEventListener('keydown', onKeyDown));

    // Paint active markers from whatever state the store has already delivered.
    const state = this.store?.getState();
    if (state !== undefined) {
      this.loop = state.loop;
      this.pip = state.isPIP;
    }
    this.markActiveItems();
  }

  /**
   * (Re)builds the item rows into the menu from the currently VISIBLE actions (`visibleActions`),
   * so ad/live/pip-availability gating adds or removes rows. Clears the previous rows first and
   * re-marks the active state afterwards. No-op before `render` created the menu container.
   */
  private buildItems(): void {
    if (this.menu === null) {
      return;
    }
    this.menu.replaceChildren();
    this.items = {};

    for (const action of this.visibleActions()) {
      const item = document.createElement('button');
      item.setAttribute('type', 'button');
      item.setAttribute('part', 'context-menu-item');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('data-action', action);

      // Leading glyph (parity with the original ICON_MAP: loop/pip icons before the label).
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.setAttribute('part', 'context-menu-icon');
      icon.innerHTML = renderSvgFromDescriptor(ACTION_ICONS[action]);
      item.appendChild(icon);

      // Label (StyledContextMenuLabel).
      const label = document.createElement('span');
      label.setAttribute('part', 'context-menu-label');
      label.textContent = this.resolveLabel(action);
      item.appendChild(label);

      // Checked marker (StyledContextMenuChecked): only the loop item is checkable; its
      // visibility is driven by `data-active` on the item (loop engaged) via the Style_Layer.
      if (action === 'loop') {
        const check = document.createElement('span');
        check.setAttribute('part', 'context-menu-checked');
        check.innerHTML = renderSvgFromDescriptor(checkedIcon);
        item.appendChild(check);
      }

      const onItemClick = (): void => this.selectAction(action);
      item.addEventListener('click', onItemClick);
      this.addDisposer(() => item.removeEventListener('click', onItemClick));

      this.items[action] = item;
      this.menu.appendChild(item);
    }

    this.markActiveItems();
  }

  /** Rebuilds the item rows when a gating flag changes. No-op before the menu exists. */
  private rebuild(): void {
    if (this.menu === null) {
      return;
    }
    this.buildItems();
  }

  /**
   * Updates each visible item's label from the resolved i18n after the labels change
   * post-render. No-op before `render` created the items.
   */
  private applyLabels(): void {
    for (const action of ACTIONS) {
      const item = this.items[action];
      if (item === undefined) {
        continue;
      }
      const label = item.querySelector('[part="context-menu-label"]');
      if (label !== null) {
        label.textContent = this.resolveLabel(action);
      }
    }
  }

  /**
   * Marks each visible action item with its active state (`data-active`) so the Style_Layer can
   * render an active marker on loop/PiP when currently engaged (Req 3.3). Iterates the RENDERED
   * items so gated-out rows are skipped. No-op before `render` created the items.
   */
  private markActiveItems(): void {
    const activeByAction: Record<ContextMenuAction, boolean> = {
      loop: this.loop,
      pip: this.pip,
    };
    for (const action of ACTIONS) {
      const item = this.items[action];
      if (item === undefined) {
        continue;
      }
      if (activeByAction[action]) {
        item.setAttribute('data-active', 'true');
      } else {
        item.removeAttribute('data-active');
      }
    }
  }
}
