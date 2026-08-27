/**
 * Typed event map for VolumeController.
 */
export interface VolumeControllerEvents {
  volumeChange: (data: { volume: number; muted: boolean }) => void;
}

export type { VolumeAdapter } from '@typings/adapters.types';
