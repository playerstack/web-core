/**
 * Types for the `playerstack-title` UI_Element. Kept out of the logic file per the
 * type-organization rules (Req 14): the element imports these names, and the Markup_Contract
 * (parts) stays documented in one place so the element and any future tests share a single
 * source of truth.
 */

/**
 * Named `part` exposed by `playerstack-title` so Skins can style the media-title read-out
 * through the light-DOM `[part]` boundary (Req 10.2). `title` is the single text node that
 * receives the consumer-provided title string.
 */
export type TitlePart = 'title';
