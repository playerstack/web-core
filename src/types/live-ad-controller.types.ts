/** Phases of a live ad break: no ad → ad playing (stream muted) → fade-out → back to idle. */
export type LiveAdPhase = 'idle' | 'playing' | 'exiting';

/** Config for a single live ad break. */
export interface LiveAdConfig {
  /** Ad video URL (mp4). Required — a break without a URL is ignored. */
  url: string;
  /** Ad title text. */
  title?: string;
  /** URL opened on CTA click. */
  clickUrl?: string;
  /** CTA button label. */
  buttonText?: string;
  /** Seconds before skip is allowed (0 = no skip). */
  skipAfter?: number;
  /** Called when the ad starts playing. */
  onStart?: () => void;
  /** Called when the ad finishes naturally. */
  onComplete?: () => void;
  /** Called when the user skips. */
  onSkip?: () => void;
  /** Called when the user clicks the CTA. */
  onClick?: () => void;
}

/** Reactive snapshot of the live-ad state a skin renders from. */
export interface LiveAdState {
  phase: LiveAdPhase;
  isActive: boolean;
  isExiting: boolean;
  url: string;
  title: string;
  buttonText: string;
  currentTime: number;
  duration: number;
  canSkip: boolean;
  skipCountdown: number;
}

/** Typed event map for LiveAdController. */
export interface LiveAdControllerEvents {
  /** Emitted on every state change with the full snapshot. */
  stateChange: (state: LiveAdState) => void;
}
