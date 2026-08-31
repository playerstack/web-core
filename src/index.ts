// Core
export { MediaEngine } from '@media-engine';
export { EventEmitter } from '@event-emitter';

// Controllers
export { PlayerOrchestrator } from '@player-orchestrator';
export type { PlayerOrchestratorConfig, PlayerOrchestratorEvents } from '@typings/player-orchestrator.types';
export { UIController } from '@ui-controller';
export type { UIControllerConfig, UIControllerEvents } from '@typings/ui-controller.types';
export { AdsController, computeAdPlaybackState } from '@ads-controller';
export type { AdsControllerEvents, AdsState } from '@typings/ads-controller.types';
export { VolumeController } from '@volume-controller';
export type { VolumeControllerEvents } from '@typings/volume-controller.types';
export { LiveDVRController } from '@live-dvr-controller';
export type { LiveDVRControllerEvents } from '@typings/live-dvr-controller.types';
export { DoubleTapController } from '@double-tap-controller';
export type { DoubleTapConfig, SkipState, DoubleTapControllerEvents } from '@typings/double-tap-controller.types';
export { FullscreenController } from '@fullscreen-controller';
export type { FullscreenControllerEvents } from '@typings/fullscreen-controller.types';
export { CastController } from '@cast-controller';
export type { CastControllerEvents } from '@typings/cast-controller.types';
export { LiveAdController, EXIT_DURATION_MS } from '@live-ad-controller';
export type { LiveAdConfig, LiveAdControllerEvents, LiveAdPhase, LiveAdState } from '@typings/live-ad-controller.types';
export {
  createPlayerCallbackProxy,
  DEFAULT_RECOVERABLE_ERROR_TYPES,
  DEFAULT_RECOVERABLE_ERROR_DETAILS,
} from '@player-callback-proxy';
export type {
  PlayerCallbackProxy,
  PlayerCallbackProxyConfig,
  PlayerProxyCallbacks,
  PlayerStateUpdate,
  PlayerErrorData,
} from '@typings/player-callback-proxy.types';

// Live DVR
export {
  computeLiveDVRState,
  computeDVRFromRange,
  isAtLiveEdgeWithHysteresis,
  liveEdgeSeekTarget,
  LIVE_EDGE_SEEK_MARGIN,
  stabilizeLiveOffset,
  LIVE_OFFSET_STABILIZE_STEP,
  sliderPositionToTime,
  formatLiveOffset,
} from '@live-dvr';
export type { LiveDVRState, LiveDVRConfig } from '@typings/live-dvr.types';

// Patterns
export {
  canPlay,
  isAudioUrl,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  HLS_EXTENSIONS,
  DASH_EXTENSIONS,
  FLV_EXTENSIONS,
} from '@patterns';

// Constants
export {
  HAS_NAVIGATOR,
  IS_IPAD_PRO,
  IS_IOS,
  IS_SAFARI,
  IS_MMS_SUPPORTED,
  IS_LIVE_DVR_SUPPORTED,
  HLS_SDK_URL,
  HLS_GLOBAL,
  DASH_SDK_URL,
  DASH_GLOBAL,
  FLV_SDK_URL,
  FLV_GLOBAL,
  DEFAULT_HLS_VERSION,
  DEFAULT_DASH_VERSION,
  DEFAULT_FLV_VERSION,
  DEFAULT_PROGRESS_INTERVAL,
  defaultMediaConfig,
} from '@constants';

// Utils (re-export for convenience)
export {
  isMediaStream,
  isBlobUrl,
  hasAudio,
  supportsWebKitPresentationMode,
  getCookie,
  setCookie,
  deleteCookie,
  isDesktop,
  isMobile,
  formatTime,
  indexBy,
  omit,
  getGlobal,
  getSDK,
  isTestEnv,
  enableStubOn,
  parseVTTCaptions,
  getActiveCues,
  hexToRgba,
  getEdgeStyleCSS,
  DEFAULT_CAPTION_STYLE,
  CAPTION_STYLE_OPTIONS,
  parseSpriteVTT,
  timeCodeToSeconds,
} from '@utils/index';

export type { VTTCue, CaptionStyleOptions } from '@typings/utils/captions.types';
export type { VttSpriteCue, SpriteFrame } from '@utils/vtt-sprite';

// Sprite Frame Computation
export { computeSpriteFrame, computeTimelensFrame } from '@sprite';
export type { SpriteCue, ComputedSpriteFrame, ComputedTimelensFrame } from '@typings/sprite.types';

// Player State
export { playerStateInitial, audioPlayerStateInitial, reduceSeekState } from '@player-state';
export type { PlayerState, AudioPlayerState } from '@player-state';

// Keyboard
export { eventsKeyCodes, keyMappings } from '@keyboard';

// Chapters
export { computeChapterSegments, getChapterAtTime } from '@chapters';
export type { ChapterInput, ChapterSegment } from '@typings/chapters.types';

// Heatmap
export { generateHeatmapPath } from '@heatmap';
export type { HeatmapDataPoint } from '@typings/heatmap.types';

// UI Sizing
export { buildIconProps, sliderWidth, buildSettingsLabel, buildSettingsOptions, settingsInitialState } from '@ui-utils';
export type { SettingsOption } from '@typings/ui.types';

// Reducer
export { createTypedReducer } from '@reducer';

// Slider Math
export {
  getEventXCoordinate,
  getClampedPosition,
  getTimeFromSliderPosition,
  getTrackTranslateX,
  getMouseTranslateX,
  getVolumePercentage,
  getVolumeFillGeometry,
  getVolumeFromPointer,
} from '@slider';
export type { VolumeFillOrigin } from '@slider';

// Quality Selection
export {
  VIDEO_QUALITY_THRESHOLDS,
  measureNetworkSpeed,
  getRecommendedVideoQuality,
  selectAutoQuality,
  validateFullHDBreak,
} from '@quality';
export type { QualitySource } from '@quality';

// i18n
export { getTranslations, en, es } from '@i18n/index';
export type { Translations, SupportedLanguage } from '@i18n/index';

// Adapters
export type {
  AdsPlatform,
  AdsConfig,
  VolumeAdapter,
  DVRAdapter,
  PlayerAdapter,
  FullscreenAdapter,
  CastAdapter,
  CastState,
  LiveAdAdapter,
  SpriteAdapter,
  SpriteSheetSizes,
} from '@typings/adapters.types';

// Composable-player-components catalog (agnostic data + pure functions, React-free — A1)
export {
  COMPOSABLE_SLOTS,
  DEFAULT_COMPOSITION,
  AUDIO_DEFAULT_COMPOSITION,
  resolveSlotOrder,
} from '@adapters/framework-adapter';
export type { SlotRegion, ComposableSlot } from '@adapters/framework-adapter';

// Types
export type {
  MediaSource,
  MediaEngineConfig,
  TrackConfig,
  MediaEngineEvents,
  MediaState,
  MediaEventHandler,
} from '@typings/media.types';

// Icons
export * from '@icons/index';
export type { IconDescriptor, SvgElement } from '@typings/icons.types';
