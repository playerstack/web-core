import { buildIconProps, sliderWidth, buildSettingsLabel, buildSettingsOptions } from '@ui-utils';

describe('buildIconProps', () => {
  test('returns 36x36 for non-fullscreen', () => {
    expect(buildIconProps()).toEqual({ width: 36, height: 36 });
    expect(buildIconProps(false)).toEqual({ width: 36, height: 36 });
  });

  test('returns 54x54 for fullscreen', () => {
    expect(buildIconProps(true)).toEqual({ width: 54, height: 54 });
  });
});

describe('sliderWidth', () => {
  test('returns 55 for non-fullscreen', () => {
    expect(sliderWidth(false)).toBe(55);
  });

  test('returns 83 for fullscreen', () => {
    expect(sliderWidth(true)).toBe(83);
  });
});

describe('buildSettingsLabel', () => {
  const i18n = { auto: 'Auto', normal: 'Normal' };

  test('returns "Auto" for quality value 0', () => {
    expect(buildSettingsLabel({ label: 'quality', value: '0', i18n })).toBe('Auto');
  });

  test('returns resolution with p suffix', () => {
    expect(buildSettingsLabel({ label: 'quality', value: '1080', i18n })).toBe('1080p');
  });

  test('returns "Normal" for speed value 1', () => {
    expect(buildSettingsLabel({ label: 'speed', value: '1', i18n })).toBe('Normal');
  });

  test('returns raw value for speed != 1', () => {
    expect(buildSettingsLabel({ label: 'speed', value: '1.5', i18n })).toBe('1.5');
  });

  test('returns value as-is for unknown label', () => {
    expect(buildSettingsLabel({ label: 'other', value: 'foo', i18n })).toBe('foo');
  });
});

describe('buildSettingsOptions', () => {
  const i18n = { speed: 'Speed', quality: 'Quality', captions: 'Captions', auto: 'Auto', off: 'Off' };

  test('includes speed when not live and not adMode', () => {
    const result = buildSettingsOptions({ qualityOptions: [], i18n });
    expect(result.some((o) => o.value === 'speed')).toBe(true);
  });

  test('excludes speed when live', () => {
    const result = buildSettingsOptions({ qualityOptions: [], live: true, i18n });
    expect(result.some((o) => o.value === 'speed')).toBe(false);
  });

  test('excludes speed when adMode', () => {
    const result = buildSettingsOptions({ qualityOptions: [], adMode: true, i18n });
    expect(result.some((o) => o.value === 'speed')).toBe(false);
  });

  test('includes quality when qualityOptions present', () => {
    const result = buildSettingsOptions({ qualityOptions: [{ label: '720p', value: '720' }], i18n });
    const qualityOption = result.find((o) => o.value === 'quality');
    expect(qualityOption).toBeDefined();
    expect(qualityOption!.options).toHaveLength(2); // 720p + Auto
  });

  test('excludes quality when qualityOptions empty', () => {
    const result = buildSettingsOptions({ qualityOptions: [], i18n });
    expect(result.some((o) => o.value === 'quality')).toBe(false);
  });

  test('includes captions when captionOptions present', () => {
    const result = buildSettingsOptions({
      qualityOptions: [],
      captionOptions: [{ label: 'English', value: 'en' }],
      i18n,
    });
    const captionOption = result.find((o) => o.value === 'captions');
    expect(captionOption).toBeDefined();
    expect(captionOption!.options).toHaveLength(2); // Off + English
  });

  test('excludes captions when captionOptions null', () => {
    const result = buildSettingsOptions({ qualityOptions: [], captionOptions: null, i18n });
    expect(result.some((o) => o.value === 'captions')).toBe(false);
  });
});
