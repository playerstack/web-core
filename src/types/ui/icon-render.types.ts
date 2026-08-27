/**
 * Options passed to `renderSvgFromDescriptor` to size the serialized SVG.
 */
export interface RenderSvgOptions {
  /** Rendered SVG width (px number or CSS length string). */
  width?: number | string;
  /** Rendered SVG height (px number or CSS length string). */
  height?: number | string;
}
