import en from '@i18n/en';
import es from '@i18n/es';

export type Translations = Record<string, string>;
export type SupportedLanguage = 'en' | 'es';

const translations: Record<SupportedLanguage, Translations> = { en, es };

/**
 * Get translations for a given language code.
 * Falls back to English if the language is not supported.
 */
export function getTranslations(language: string): Translations {
  return translations[language as SupportedLanguage] ?? en;
}

export { en, es };
export default translations;
