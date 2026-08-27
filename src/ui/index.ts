/**
 * Public barrel for the `@playerstack/core/ui` subpath (Req 1.1, 11.1).
 *
 * Re-exports the UI_Layer surface a consumer needs to build a player without a
 * framework: the base `PlayerstackElement`, the idempotent registration entry point
 * and its `PLAYERSTACK_ELEMENTS` table, the `MediaController`, the `createMediaStore`
 * factory, the media-context provide/consume helpers, the pure prop<->attribute and
 * adapter-conformance/icon-render helpers, and every `playerstack-*` UI_Element class.
 * Value re-exports use `export`; type-only re-exports use `export type`.
 */

// Base Custom Element every UI_Element extends.
export { PlayerstackElement } from '@ui/playerstack-element';

// Idempotent registration entry point and the element definition table it consumes.
export { registerPlayerstackElements } from '@ui/register';
export { PLAYERSTACK_ELEMENTS } from '@ui/element-registry';

// Request/Response core: controller, reactive store factory and media-context helpers.
export { MediaController } from '@ui/media-controller';
export { createMediaStore } from '@ui/media-store';
export { provideMediaContext, requestMediaContext, MEDIA_CONTEXT_EVENT } from '@ui/media-context';

// Pure UI helpers.
export { propToAttribute, attributeToProp } from '@ui/attribute-reflect';
export { assertPlayerAdapter } from '@ui/adapter-conformance';
export { renderSvgFromDescriptor } from '@ui/icon-render';

// UI_Elements — root host, main controls, content/overlays and specialized elements.
export { PlayerstackMediaController } from '@ui/elements/playerstack-media-controller';
export { PlayerstackPlayButton } from '@ui/elements/playerstack-play-button';
export { PlayerstackVolume } from '@ui/elements/playerstack-volume';
export { PlayerstackTimeSlider } from '@ui/elements/playerstack-time-slider';
export { PlayerstackPlayTime } from '@ui/elements/playerstack-play-time';
export { PlayerstackSettings } from '@ui/elements/playerstack-settings';
export { PlayerstackFullscreenButton } from '@ui/elements/playerstack-fullscreen-button';
export { PlayerstackPipButton } from '@ui/elements/playerstack-pip-button';
export { PlayerstackCaptions } from '@ui/elements/playerstack-captions';
export { PlayerstackChapters } from '@ui/elements/playerstack-chapters';
export { PlayerstackHeatmap } from '@ui/elements/playerstack-heatmap';
export { PlayerstackContextMenu } from '@ui/elements/playerstack-context-menu';
export { PlayerstackSpinner } from '@ui/elements/playerstack-spinner';
export { PlayerstackPlayState } from '@ui/elements/playerstack-play-state';
export { PlayerstackTopState } from '@ui/elements/playerstack-top-state';
export { PlayerstackPreventedTip } from '@ui/elements/playerstack-prevented-tip';
export { PlayerstackAudioControls } from '@ui/elements/playerstack-audio-controls';
export { PlayerstackAdOverlay } from '@ui/elements/playerstack-ad-overlay';
export { PlayerstackLiveIndicator } from '@ui/elements/playerstack-live-indicator';
export { PlayerstackDoubleTap } from '@ui/elements/playerstack-double-tap';
export { PlayerstackIcon } from '@ui/elements/playerstack-icon';
export { PlayerstackNavButtons } from '@ui/elements/playerstack-nav-buttons';

// Public types.
export type { MediaStore, MediaStoreState, MediaStoreListener } from '@typings/ui/media-store.types';
export type { MediaControllerConfig, RequestEventName } from '@typings/ui/media-controller.types';
export type {
  AttributeSchema,
  AttributeSchemaEntry,
  MediaContextConsumer,
} from '@typings/ui/playerstack-element.types';
export type { PlayerstackElementDefinition } from '@typings/ui/register.types';
export type { MediaContext } from '@typings/ui/media-context.types';
export type {
  NavButtonsPart,
  NavPrevDefaultLabel,
  NavNextDefaultLabel,
} from '@typings/ui/playerstack-nav-buttons.types';
export type { CaptionRequestDetail } from '@typings/ui/playerstack-captions.types';
