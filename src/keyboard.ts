/**
 * Keyboard event key-code to action name mappings.
 * Framework-agnostic — usable by any PlayerStack wrapper.
 */
export const eventsKeyCodes: Record<number, string> = {
  32: 'SPACE_KEY',
  27: 'ESCAPE_KEY',
  37: 'ARROW_LEFT_KEY',
  39: 'ARROW_RIGHT_KEY',
  38: 'ARROW_UP_KEY',
  40: 'ARROW_DOWN_KEY',
  77: 'MUTE_KEY',
  16: 'SHIFT_KEY',
  67: 'SUBTITLES_KEY',
  70: 'F_KEY',
  84: 'T_KEY',
  78: 'N_KEY',
};

/**
 * Keyboard event key string to action name mappings.
 * Uses KeyboardEvent.key values (preferred over keyCodes).
 */
export const keyMappings: Record<string, string> = {
  ' ': 'SPACE_KEY',
  Escape: 'ESCAPE_KEY',
  ArrowLeft: 'ARROW_LEFT_KEY',
  ArrowRight: 'ARROW_RIGHT_KEY',
  ArrowUp: 'ARROW_UP_KEY',
  ArrowDown: 'ARROW_DOWN_KEY',
  m: 'MUTE_KEY',
  Shift: 'SHIFT_KEY',
  c: 'SUBTITLES_KEY',
  f: 'F_KEY',
  t: 'T_KEY',
  n: 'N_KEY',
};
