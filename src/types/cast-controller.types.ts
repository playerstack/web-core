import type { CastState } from '@typings/adapters.types';

/** Typed event map for CastController. */
export interface CastControllerEvents {
  /** Emitted whenever the cast connection state changes. */
  stateChange: (state: CastState) => void;
  /** Emitted whenever device availability changes. */
  availabilityChange: (available: boolean) => void;
}
