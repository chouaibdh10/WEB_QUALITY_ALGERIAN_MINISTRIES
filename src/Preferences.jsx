import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PreferencesContext = createContext(null)
export const supportedLanguages = ['en', 'fr', 'ar']
const locales = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }
export const pageMetadata = {
  en: { title: 'Clarity DZ | Algerian Ministries 2026', description: 'Explore Algerian ministry websites and an evidence-first methodology for security, performance, accessibility and public web quality.' },
  fr: { title: 'Clarity DZ | Ministères algériens 2026', description: 'Explorez les sites des ministères algériens et une méthodologie fondée sur les preuves pour la sécurité, la performance et l’accessibilité du web public.' },
  ar: { title: 'Clarity DZ | الوزارات الجزائرية 2026', description: 'استكشف مواقع الوزارات الجزائرية ومنهجية قائمة على الأدلة لقياس الأمن والأداء وإمكانية الوصول وجودة الويب العمومي.' },
}
const store = (key, value) => { try { localStorage.setItem(key, value) } catch { /* Preferences remain usable when browser storage is unavailable. */ } }

export function PreferencesProvider({ children }) {
  const [language, setLanguageState] = useState(() => supportedLanguages.includes(document.documentElement.lang) ? document.documentElement.lang : 'en')
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const setLanguage = useCallback(value => {
    if (!supportedLanguages.includes(value)) return
    setLanguageState(value)
    store('wqi-language', value)
  }, [])
  const setTheme = useCallback(value => {
    if (!['light', 'dark'].includes(value)) return
    setThemeState(value)
    store('wqi-theme', value)
  }, [])
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.querySelector('meta[name="description"]')?.setAttribute('content', pageMetadata[language].description)
  }, [language])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101a15' : '#f7f8f2')
  }, [theme])
  const formatter = useMemo(() => new Intl.NumberFormat(locales[language], { useGrouping: false }), [language])
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locales[language], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), [language])
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme, direction: language === 'ar' ? 'rtl' : 'ltr', locale: locales[language],
    number: value => formatter.format(value), date: value => dateFormatter.format(new Date(value)),
    reportHref: `/reports/methodology-${language === 'fr' ? 'fr' : 'en'}.pdf`, reportLanguage: language === 'fr' ? 'fr' : 'en',
    logoSrc: `/brand/${theme === 'dark' ? 'wqi-mark-dark-v4' : 'wqi-mark-v4'}.svg`,
  }), [language, setLanguage, theme, setTheme, formatter, dateFormatter])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext)
  if (!preferences) throw new Error('usePreferences must be used within PreferencesProvider')
  return preferences
}
