/**
 * Configuration for DoubleTapController constructor.
 */
export interface DoubleTapConfig {
  /** Seconds to skip per double-tap. Default: 10. */
  skipSeconds?: number;
  /** Milliseconds to wait for second tap. Default: 300. */
  doubleTapDelay?: number;
  /** Milliseconds to show skip indicator before auto-hiding. Default: 1000. */
  displayDuration?: number;
}

/**
 * Current skip indicator state.
 */
export interface SkipState {
  direction: 'forward' | 'backward' | null;
  visible: boolean;
  seconds: number;
}

/**
 * Typed event map for DoubleTapController.
 */
export interface DoubleTapControllerEvents {
  skip: (state: SkipState) => void;
  singleTap: (side: 'left' | 'right') => void;
}
