/**
 * Player UI sizing utilities.
 * Framework-agnostic — used by skin components for consistent sizing.
 */

import type { SettingsOption } from '@typings/ui.types';

export type { SettingsOption } from '@typings/ui.types';

/**
 * Get icon dimensions based on fullscreen state.
 */
export const buildIconProps = (isFullscreen = false): { width: number; height: number } => {
  if (isFullscreen) {
    return { width: 54, height: 54 };
  }
  return { width: 36, height: 36 };
};

/**
 * Get volume slider width based on fullscreen state.
 */
export const sliderWidth = (isFullscreen: boolean): number => {
  if (isFullscreen) {
    return 83;
  }
  return 55;
};

/**
 * Initial state for the settings menu panels.
 */
export const settingsInitialState = {
  generalMenu: false,
  speed: false,
  quality: false,
  captions: false,
} as const;

export const buildSettingsLabel = ({
  label,
  value,
  i18n,
}: {
  label: string;
  value: string;
  i18n: { auto?: string; normal?: string; [key: string]: string | undefined };
}): string => {
  if (label === 'quality') {
    if (value === '0') {
      return i18n.auto || 'Auto';
    }
    return `${value}p`;
  } else if (label === 'speed' && value === '1') {
    return i18n.normal || 'Normal';
  }
  return value;
};

/**
 * Build the settings overlay menu structure from available options.
 */
export const buildSettingsOptions = ({
  qualityOptions,
  captionOptions,
  live,
  adMode = false,
  i18n,
}: {
  qualityOptions: Array<{ label: string; value: string; isFullHD?: boolean }>;
  captionOptions?: Array<{ label: string; value: string }> | null;
  live?: boolean;
  adMode?: boolean;
  i18n: {
    speed?: string;
    quality?: string;
    captions?: string;
    auto?: string;
    off?: string;
    [key: string]: string | undefined;
  };
}): SettingsOption[] => {
  const options: SettingsOption[] = [];

  if (!live && !adMode) {
    options.push({
      label: i18n.speed || 'Speed',
      value: 'speed',
      options: [
        { label: '2', value: '2' },
        { label: '1.5', value: '1.5' },
        { label: '1.25', value: '1.25' },
        { label: 'Normal', value: '1' },
        { label: '0.75', value: '0.75' },
        { label: '0.5', value: '0.5' },
        { label: '0.25', value: '0.25' },
      ],
    });
  }

  if (qualityOptions.length > 0) {
    options.push({
      label: i18n.quality || 'Quality',
      value: 'quality',
      options: [...qualityOptions, { label: i18n.auto || 'Auto', value: '0', isFullHD: false }],
    });
  }

  if (captionOptions && captionOptions.length > 0) {
    options.push({
      label: i18n.captions || 'Captions',
      value: 'captions',
      options: [{ label: i18n.off || 'Off', value: 'off' }, ...captionOptions],
    });
  }

  return options;
};
