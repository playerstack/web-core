/**
 * Snapshot of the current ad state.
 */
export interface AdsState {
  isAdActive: boolean;
  hasSkipTimer: boolean;
  canSkip: boolean;
  skipCountdown: number;
  adProgress: number;
}

/**
 * Typed event map for AdsController.
 */
export interface AdsControllerEvents {
  adActivated: () => void;
  adSkippable: () => void;
  adCompleted: () => void;
  adProgress: (data: { progress: number; canSkip: boolean; skipCountdown: number }) => void;
  stateChange: (state: AdsState) => void;
  /** Emitted when `configure` toggles ads on/off — the media source changed, reload from 0. */
  sourceReset: () => void;
}

export type { AdsConfig } from '@typings/adapters.types';
