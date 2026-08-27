/**
 * A cue from a parsed sprite VTT file with numeric coordinates.
 */
export interface SpriteCue {
  from: number;
  to: number;
  x: number;
  y: number;
  w: number;
  h: number;
  file: string;
}

/**
 * Computed sprite frame geometry for rendering a sprite within a container.
 */
export interface ComputedSpriteFrame {
  file: string;
  scale: number;
  bgW: number;
  bgH: number;
  bgPosX: number;
  bgPosY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Native (1:1, unscaled) sprite frame geometry for the timelens hover thumbnail. Unlike
 * `ComputedSpriteFrame` (which cover-scales a frame to fill a container), this renders the
 * matched cue at its NATIVE pixel size with no background sizing — the box is sized to the
 * cue's own `w`/`h` and the sheet is offset by `-x`/`-y`. This matches the original desktop
 * `Timelens` thumbnail (parity): a small, crisp, 1:1 preview above the slider on hover.
 */
export interface ComputedTimelensFrame {
  /** The sprite sheet image URL for the matched cue. */
  file: string;
  /** The matched cue's native width in pixels (the thumbnail box width). */
  w: number;
  /** The matched cue's native height in pixels (the thumbnail box height). */
  h: number;
  /** `background-position-x` in pixels (`-cue.x`). */
  bgPosX: number;
  /** `background-position-y` in pixels (`-cue.y`). */
  bgPosY: number;
}
