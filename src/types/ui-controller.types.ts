/**
 * Configuration for UIController constructor.
 */
export interface UIControllerConfig {
  /** Milliseconds before auto-hide triggers. Default: 3000. */
  hideDelay?: number;
}

/**
 * Typed event map for UIController.
 */
export interface UIControllerEvents {
  controlsVisibilityChange: (visible: boolean) => void;
  settingsChange: (open: boolean) => void;
}
