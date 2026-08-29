/**
 * Central table of all Playerstack UI_Elements (Req 1.1, 1.4).
 *
 * `PLAYERSTACK_ELEMENTS` lists every Custom Element as a `{ name, ctor }` pair, and
 * `registerPlayerstackElements` (see `@ui/register`) consumes this table to define each
 * element in the `CustomElementRegistry` under its `playerstack-` prefixed name.
 *
 * WHY it starts empty: the individual UI_Element classes are implemented incrementally in
 * later tasks (8.x for the main controls, 9.x for the content/overlay/specialized elements).
 * As each UI_Element is implemented, that task appends its own `{ name, ctor }` entry here.
 * Keeping this file free of imports to not-yet-existing element classes lets the build stay
 * green while the registry grows one element at a time.
 */
import type { PlayerstackElementDefinition } from '@typings/ui/register.types';
import { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
import { PlayerstackPlayButton } from '@ui/elements/playerstack-play-button';
import { PlayerstackFullscreenButton } from '@ui/elements/playerstack-fullscreen-button';
import { PlayerstackPipButton } from '@ui/elements/playerstack-pip-button';
import { PlayerstackVolume } from '@ui/elements/playerstack-volume';
import { PlayerstackTimeSlider } from '@ui/elements/playerstack-time-slider';
import { PlayerstackPlayTime } from '@ui/elements/playerstack-play-time';
import { PlayerstackSettings } from '@ui/elements/playerstack-settings';
import { PlayerstackCaptions } from '@ui/elements/playerstack-captions';
import { PlayerstackChapters } from '@ui/elements/playerstack-chapters';
import { PlayerstackHeatmap } from '@ui/elements/playerstack-heatmap';
import { PlayerstackContextMenu } from '@ui/elements/playerstack-context-menu';
import { PlayerstackSpinner } from '@ui/elements/playerstack-spinner';
import { PlayerstackPlayState } from '@ui/elements/playerstack-play-state';
import { PlayerstackTopState } from '@ui/elements/playerstack-top-state';
import { PlayerstackPreventedTip } from '@ui/elements/playerstack-prevented-tip';
import { PlayerstackAudioControls } from '@ui/elements/playerstack-audio-controls';
import { PlayerstackAdOverlay } from '@ui/elements/playerstack-ad-overlay';
import { PlayerstackLiveIndicator } from '@ui/elements/playerstack-live-indicator';
import { PlayerstackDoubleTap } from '@ui/elements/playerstack-double-tap';
import { PlayerstackIcon } from '@ui/elements/playerstack-icon';
import { PlayerstackNavButtons } from '@ui/elements/playerstack-nav-buttons';
import { PlayerstackMobileSettings } from '@ui/elements/playerstack-mobile-settings';
import { PlayerstackSpritePreview } from '@ui/elements/playerstack-sprite-preview';
import { PlayerstackLiveAd } from '@ui/elements/playerstack-live-ad';
import { PlayerstackTitle } from '@ui/elements/playerstack-title';

export const PLAYERSTACK_ELEMENTS: readonly PlayerstackElementDefinition[] = [
  // Root host element (task 8.1); other UI_Element tasks (8.x / 9.x) append their own
  // `{ name, ctor }` definitions below as each element is implemented.
  { name: 'playerstack-media-controller', ctor: PlayerstackMediaController },
  { name: 'playerstack-play-button', ctor: PlayerstackPlayButton },
  { name: 'playerstack-volume', ctor: PlayerstackVolume },
  { name: 'playerstack-time-slider', ctor: PlayerstackTimeSlider },
  { name: 'playerstack-play-time', ctor: PlayerstackPlayTime },
  { name: 'playerstack-settings', ctor: PlayerstackSettings },
  { name: 'playerstack-fullscreen-button', ctor: PlayerstackFullscreenButton },
  { name: 'playerstack-pip-button', ctor: PlayerstackPipButton },
  { name: 'playerstack-captions', ctor: PlayerstackCaptions },
  { name: 'playerstack-chapters', ctor: PlayerstackChapters },
  { name: 'playerstack-heatmap', ctor: PlayerstackHeatmap },
  { name: 'playerstack-context-menu', ctor: PlayerstackContextMenu },
  { name: 'playerstack-spinner', ctor: PlayerstackSpinner },
  { name: 'playerstack-play-state', ctor: PlayerstackPlayState },
  { name: 'playerstack-top-state', ctor: PlayerstackTopState },
  { name: 'playerstack-prevented-tip', ctor: PlayerstackPreventedTip },
  { name: 'playerstack-audio-controls', ctor: PlayerstackAudioControls },
  { name: 'playerstack-ad-overlay', ctor: PlayerstackAdOverlay },
  { name: 'playerstack-live-indicator', ctor: PlayerstackLiveIndicator },
  { name: 'playerstack-double-tap', ctor: PlayerstackDoubleTap },
  { name: 'playerstack-icon', ctor: PlayerstackIcon },
  { name: 'playerstack-nav-buttons', ctor: PlayerstackNavButtons },
  { name: 'playerstack-mobile-settings', ctor: PlayerstackMobileSettings },
  { name: 'playerstack-sprite-preview', ctor: PlayerstackSpritePreview },
  { name: 'playerstack-live-ad', ctor: PlayerstackLiveAd },
  // `playerstack-title` — media-title read-out (composable-player-components task 9.1, A2).
  { name: 'playerstack-title', ctor: PlayerstackTitle },
];
