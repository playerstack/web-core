/**
 * Types for the `playerstack-context-menu` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) plus the configurable item labels stay documented in one place so the element and
 * any future tests share a single source of truth. The `UIControllerConfig` is reused from
 * the shared `ui-controller` types (Req 1.6) so the menu never redefines the controller
 * config model.
 */
import type { UIControllerConfig } from '@typings/ui-controller.types';

/**
 * Named Shadow DOM `part`s exposed by `playerstack-context-menu` so Skins can style the menu
 * container and each action item through the shadow boundary (Req 5.1, 5.3):
 *   - `context-menu` is the container; it carries the reflected `data-open` state when the
 *     menu is showing and is positioned at the pointer on right-click.
 *   - `context-menu-item` is each action row (loop / PiP / fullscreen). Each item carries a
 *     `data-action` hook and a reflected active marker (`data-active`) mirrored from the store.
 *   - `context-menu-icon` is the leading glyph, `context-menu-label` the text, and
 *     `context-menu-checked` the trailing check shown on the active loop item.
 */
export type ContextMenuPart =
  'context-menu' | 'context-menu-item' | 'context-menu-icon' | 'context-menu-label' | 'context-menu-checked';

/**
 * The three context-menu actions, matching the classic right-click menu (loop / PiP /
 * fullscreen). Kept as a named union so the element and tests agree on the action set and the
 * `data-action` values reflected on each item.
 */
export type ContextMenuAction = 'loop' | 'pip';

/**
 * Default English labels applied to each action when the consumer does not provide an i18n
 * override (Req 1.5). Named type so the element and tests agree on the defaults. Parity: the
 * original right-click menu offered only Loop + Picture in Picture (no Fullscreen row).
 */
export interface ContextMenuDefaultLabels {
  loop: 'Loop';
  pip: 'Picture in Picture';
}

/**
 * Optional per-action label overrides the consumer/adapter can supply. Any omitted action
 * falls back to its English default. Kept as a partial map keyed by `ContextMenuAction` so a
 * Skin can translate individual items without providing all three.
 */
export type ContextMenuI18n = Partial<Record<ContextMenuAction, string>>;

/**
 * Re-export of the shared `UIControllerConfig` (Req 1.6) so a Skin that instantiates the menu
 * can reuse the same auto-hide configuration shape the rest of the UI_Layer uses without
 * importing the controller types directly. Exposed here as the element's public config type.
 */
export type ContextMenuConfig = UIControllerConfig;
