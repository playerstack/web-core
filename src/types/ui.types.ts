export interface SettingsOption {
  label: string;
  value: string;
  options: Array<{ label: string; value: string; isFullHD?: boolean }>;
}
