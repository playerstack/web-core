/**
 * Single source of truth for the PlayerStack Design_Tokens (Req 4.1).
 *
 * These tokens are compiled to `--playerstack-<category>-<name>` CSS_Custom_Properties
 * by `token-css.ts`. Names are kept lowercase and hyphen-separated so each token maps to
 * a valid CSS variable segment and roundtrips cleanly (var name -> token id).
 *
 * The `{ category, name }` pair of every entry is unique: it is the identity used to
 * build the CSS variable name, so duplicates would collide on the same variable.
 */
import type { DesignTokenSet } from '@typings/styles/tokens.types';

/**
 * Default Design_Tokens for the media player skin. Consumers override any value by
 * declaring the matching `--playerstack-*` custom property; these act as the fallbacks
 * (Req 4.3, 4.4).
 */
export const DESIGN_TOKENS: DesignTokenSet = [
  // color — surfaces, foregrounds and accents. rgba is used where the player overlays
  // content on top of video, so translucency is part of the design intent.
  { category: 'color', name: 'accent', value: '#ff375f' },
  { category: 'color', name: 'accent-hover', value: '#ff5c7c' },
  { category: 'color', name: 'bg', value: '#000000' },
  { category: 'color', name: 'fg', value: '#ffffff' },
  { category: 'color', name: 'muted', value: 'rgba(255, 255, 255, 0.62)' },
  { category: 'color', name: 'control-bg', value: 'rgba(0, 0, 0, 0.55)' },
  { category: 'color', name: 'control-fg', value: '#ffffff' },
  { category: 'color', name: 'control-hover', value: 'rgba(255, 255, 255, 0.16)' },
  { category: 'color', name: 'overlay', value: 'rgba(0, 0, 0, 0.45)' },
  { category: 'color', name: 'track', value: 'rgba(255, 255, 255, 0.28)' },
  { category: 'color', name: 'track-buffered', value: 'rgba(255, 255, 255, 0.45)' },
  { category: 'color', name: 'focus-ring', value: 'rgba(255, 55, 95, 0.75)' },

  // space — spacing scale used for padding, gaps and control offsets.
  { category: 'space', name: 'xs', value: '4px' },
  { category: 'space', name: 'sm', value: '8px' },
  { category: 'space', name: 'md', value: '12px' },
  { category: 'space', name: 'lg', value: '16px' },
  { category: 'space', name: 'xl', value: '24px' },

  // font — typography. `family-base` is a system font stack so the player matches the
  // host UI without shipping web fonts.
  {
    category: 'font',
    name: 'family-base',
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { category: 'font', name: 'size-sm', value: '12px' },
  { category: 'font', name: 'size-md', value: '14px' },
  { category: 'font', name: 'size-lg', value: '18px' },
  { category: 'font', name: 'weight-normal', value: '400' },
  { category: 'font', name: 'weight-bold', value: '600' },

  // radius — corner rounding. `full` is a large value used for pill/circular controls.
  { category: 'radius', name: 'sm', value: '4px' },
  { category: 'radius', name: 'md', value: '8px' },
  { category: 'radius', name: 'lg', value: '12px' },
  { category: 'radius', name: 'full', value: '9999px' },
];
