import { createI18n } from 'vue-i18n'
import en from './locales/en'
import es from './locales/es'
import pt from './locales/pt'
import fr from './locales/fr'

export const SUPPORTED = ['en', 'es', 'pt', 'fr'] as const
export type SupportedLocale = (typeof SUPPORTED)[number]

export function detectLocale(preferred: string | null): SupportedLocale {
  const candidate = (preferred ?? navigator.language).slice(0, 2).toLowerCase()
  return SUPPORTED.includes(candidate as SupportedLocale) ? (candidate as SupportedLocale) : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, es, pt, fr }
})

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
}
