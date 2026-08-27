import { eventsKeyCodes, keyMappings } from '@keyboard';

describe('eventsKeyCodes', () => {
  test('maps space keycode to SPACE_KEY', () => {
    expect(eventsKeyCodes[32]).toBe('SPACE_KEY');
  });

  test('maps escape keycode to ESCAPE_KEY', () => {
    expect(eventsKeyCodes[27]).toBe('ESCAPE_KEY');
  });

  test('maps arrow keys', () => {
    expect(eventsKeyCodes[37]).toBe('ARROW_LEFT_KEY');
    expect(eventsKeyCodes[39]).toBe('ARROW_RIGHT_KEY');
    expect(eventsKeyCodes[38]).toBe('ARROW_UP_KEY');
    expect(eventsKeyCodes[40]).toBe('ARROW_DOWN_KEY');
  });

  test('maps M to MUTE_KEY', () => {
    expect(eventsKeyCodes[77]).toBe('MUTE_KEY');
  });

  test('maps F to F_KEY', () => {
    expect(eventsKeyCodes[70]).toBe('F_KEY');
  });
});

describe('keyMappings', () => {
  test('maps space string to SPACE_KEY', () => {
    expect(keyMappings[' ']).toBe('SPACE_KEY');
  });

  test('maps Escape to ESCAPE_KEY', () => {
    expect(keyMappings['Escape']).toBe('ESCAPE_KEY');
  });

  test('maps arrow keys', () => {
    expect(keyMappings['ArrowLeft']).toBe('ARROW_LEFT_KEY');
    expect(keyMappings['ArrowRight']).toBe('ARROW_RIGHT_KEY');
    expect(keyMappings['ArrowUp']).toBe('ARROW_UP_KEY');
    expect(keyMappings['ArrowDown']).toBe('ARROW_DOWN_KEY');
  });

  test('maps m to MUTE_KEY', () => {
    expect(keyMappings['m']).toBe('MUTE_KEY');
  });

  test('maps f to F_KEY', () => {
    expect(keyMappings['f']).toBe('F_KEY');
  });
});
