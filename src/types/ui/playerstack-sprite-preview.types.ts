/**
 * Types for the `playerstack-sprite-preview` UI_Element.
 *
 * The sprite preview shows a single thumbnail frame (scaled to cover the whole player area)
 * while the user scrubs. The frame-selection MATH is the shared pure `computeSpriteFrame`; the
 * fetch / image-measuring / container-sizing I/O is supplied by an injected `SpriteAdapter`.
 */

/** Named Shadow DOM `part`s exposed for styling through the shadow boundary. */
export type SpritePreviewPart = 'sprite-preview' | 'sprite-preview-frame';
