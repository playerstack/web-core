import type { LiveDVRState } from '@typings/live-dvr.types';

/**
 * Typed event map for LiveDVRController.
 */
export interface LiveDVRControllerEvents {
  dvrStateChange: (state: LiveDVRState | null) => void;
}

export type { DVRAdapter } from '@typings/adapters.types';
export type { LiveDVRState } from '@typings/live-dvr.types';
