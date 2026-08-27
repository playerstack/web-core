import { getTranslations, en, es } from '@i18n/index';

describe('i18n', () => {
  it('returns English translations by default', () => {
    const t = getTranslations('en');
    expect(t.play).toBe('Play');
    expect(t.pause).toBe('Pause');
  });

  it('returns Spanish translations', () => {
    const t = getTranslations('es');
    expect(t.play).toBe('Reproducir');
    expect(t.pause).toBe('Pausar');
  });

  it('falls back to English for unknown language', () => {
    const t = getTranslations('fr');
    expect(t.play).toBe('Play');
  });

  it('en and es have same keys', () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(enKeys).toEqual(esKeys);
  });
});
