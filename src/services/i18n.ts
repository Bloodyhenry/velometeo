import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  type Lang,
  type TranslationKey,
  getBrowserLang,
  setSavedLang,
  t,
  getWindCategoryLabel,
  getDominantWindLabel,
  getWmoWeatherDetails,
  translations,
} from './i18n-core'

export {
  type Lang,
  type TranslationKey,
  getBrowserLang,
  setSavedLang,
  t,
  getWindCategoryLabel,
  getDominantWindLabel,
  getWmoWeatherDetails,
  translations,
}

interface I18nContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(getBrowserLang)

  const setLang = (newLang: Lang) => {
    setLangState(newLang)
    setSavedLang(newLang)
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
      document.title =
        lang === 'en'
          ? 'VeloMétéo - Weather & wind on GPX bike routes'
          : 'VeloMétéo - Prévisions météo & vent sur trace GPX vélo'
    }
  }, [lang])

  const contextValue: I18nContextType = {
    lang,
    setLang,
    t: (key, params) => t(key, params, lang),
  }

  return React.createElement(I18nContext.Provider, { value: contextValue }, children)
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    const fallbackLang = getBrowserLang()
    return {
      lang: fallbackLang,
      setLang: () => {},
      t: (key, params) => t(key, params, fallbackLang),
    }
  }
  return ctx
}
