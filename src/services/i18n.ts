import React, { createContext, useContext, useState, useEffect } from 'react'
import type { WindCategory } from '../types'

export type Lang = 'fr' | 'en'

// ponytail: Simple browser language detection with localStorage persistence.
// Ceiling: FR and EN only. Upgrade path: add DE, ES, IT, NL matching Komoot/Strava userbases.
export function getBrowserLang(): Lang {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('velometeo_lang')
    if (saved === 'fr' || saved === 'en') return saved
  }
  const navLang =
    (typeof navigator !== 'undefined' &&
      (navigator.language || (navigator.languages && navigator.languages[0]))) ||
    ''
  return navLang.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function setSavedLang(lang: Lang): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('velometeo_lang', lang)
    } catch {}
  }
}

export const translations = {
  fr: {
    // Header & Global
    appName: 'VeloMétéo',
    appBadge: 'Météo GPX',
    appSubtitle: 'Prévisions météo & vent relatif synchronisés sur votre itinéraire cycliste',
    fullScreen: 'Plein écran',
    fullScreenTitle: 'Ouvrir dans un grand onglet',
    unexpectedError: 'Erreur inattendue',
    errorOccurred: 'Une erreur est survenue',
    gpxReadError: 'Erreur de lecture du fichier GPX',
    selectGpxAlert: 'Veuillez sélectionner un fichier au format .gpx',

    // Detected tab banner
    activeOnMap: 'Actif sur la carte',
    syncDescStrava:
      'Parcours ou activité Strava synchronisé — Tous les réglages (espacement balises, vitesse cible, départ) sont directement ajustables dans la fenêtre flottante sur votre carte.',
    syncDescKomoot:
      'Parcours Komoot synchronisé — Tous les réglages (espacement balises, vitesse cible, départ) sont directement ajustables dans la fenêtre flottante sur votre carte.',
    detectedStravaPage:
      'Page Strava détectée — Ouvrez ou tracez un itinéraire / une activité pour projeter automatiquement les balises météo et le calcul du vent.',
    detectedKomootPage: 'Page Komoot détectée — Ouvrez un parcours pour lancer la météo.',

    // File Upload
    dropzoneText: 'Glissez-déposez votre fichier',
    dropzoneTextAfter: 'ici, ou cliquez pour parcourir',
    loadDemoBtn: 'Charger la trace de démo',
    demoFileName: 'Boucle Démo - Col de Porte & Chartreuse (65 km)',
    demoFileNameShort: 'Boucle Démo - Col de Porte (65 km)',

    // Controls
    rideSettings: 'Paramètres de la sortie',
    calcWeather: 'Calculer la météo',
    calculating: 'Calcul météo...',
    departureTime: 'Date & Heure de départ',
    hourlyForecast: 'Prévisions heure par heure',
    targetSpeed: 'Vitesse moyenne cible',
    speedStandard: 'standard',
    elevationWeight: 'Pondération relief',
    flat: 'Plat',
    realistic: 'Réaliste',
    strict: 'Strict',
    weatherSpacing: 'Espacement météo',
    everyXKm: 'Tous les {km} km',
    dense: 'dense',
    sparse: 'léger',

    // Ride Summary
    departureAt: 'Départ prévu à',
    arrivalAt: 'Arrivée estimée à',
    distance: 'Distance',
    elevationGain: 'Dénivelé +',
    duration: 'Durée',
    avgWind: 'Vent moy.',
    maxGusts: 'Rafales max : {val} km/h',
    temperatures: 'Températures',
    minMaxRoute: 'Min / Max en route',
    rainRisk: 'Risque pluie',
    rainAlertPackJacket: 'Prévoyez le k-way 🌧️',
    rainAlertDry: 'Temps sec attendu ✨',
    windDistribution: 'Répartition du vent sur le trajet :',
    headwindPct: 'Face : {val}%',
    crosswindPct: 'Travers : {val}%',
    tailwindPct: 'Dos : {val}%',

    // Map & Profile
    mapTitle: 'Carte du parcours & vecteurs de vent',
    mapHead: 'Vent face',
    mapCross: 'Travers',
    mapTail: 'Dos',
    profileTitle: 'Profil altimétrique & balises météo',
    profileSubtitle: 'Survolez la courbe pour explorer le relief',
    elevation: 'Altitude',
    grade: 'Pente locale',
    passingAt: 'Passage :',
    feelsLike: 'ressenti',
    precipitation: 'Précipitations :',
    loadingWeather: 'Chargement météo...',

    // Weather Timeline
    timelineTitle: 'Déroulé météo chronologique étape par étape',
    timelineSubtitle: '{count} points de contrôle analysés',
    startPoint: 'DÉPART',
    finishPoint: 'ARRIVÉE',
    checkpointNum: 'Point #{idx}',
    riderBearing: 'Cap cycliste {bearing}° • Vent {wind}°',
    gustsUpTo: 'Rafales à {val} km/h',
    headwindResistance: 'Résistance face : +{val} km/h',
    tailwindBoost: 'Poussée dos : {val} km/h',
    lateralWind: 'Latéral : {val} km/h',

    // In-page Overlay Widget
    widgetCalculating: 'Calcul...',
    widgetHide: 'Masquer',
    widgetShow: 'Afficher',
    widgetAvgWind: 'Vent moy. {avg} km/h • Rafales {max} km/h',
    widgetHead: 'Face',
    widgetCross: 'Côté',
    widgetTail: 'Dos',
    widgetSpacing: '📍 Espacement balises',
    widgetSpeed: '⚡ Vitesse moyenne',
    widgetDeparture: '🕐 Date & heure de départ',
    widgetPassing: 'Passage :',
    widgetRain: 'Pluie :',
    widgetGusts: 'Rafales :',

    // Footer
    weatherBy: 'Données météo fournies par',
    mappingBy: 'Cartographie ©',
    footerNotice:
      'VeloMétéo est un projet libre (MIT) et indépendant, non affilié à Komoot GmbH. Données fournies à titre indicatif.',
  },
  en: {
    // Header & Global
    appName: 'VeloMétéo',
    appBadge: 'GPX Weather',
    appSubtitle: 'Hour-by-hour weather & relative wind forecasts along your cycling route',
    fullScreen: 'Full screen',
    fullScreenTitle: 'Open in a full tab',
    unexpectedError: 'Unexpected error',
    errorOccurred: 'An error occurred',
    gpxReadError: 'Error reading GPX file',
    selectGpxAlert: 'Please select a .gpx file',

    // Detected tab banner
    activeOnMap: 'Active on map',
    syncDescStrava:
      'Strava route or activity synced — All settings (marker spacing, target speed, departure) are adjustable directly in the floating overlay on your map.',
    syncDescKomoot:
      'Komoot tour synced — All settings (marker spacing, target speed, departure) are adjustable directly in the floating overlay on your map.',
    detectedStravaPage:
      'Strava page detected — Open or plan a route/activity to automatically project weather markers and wind calculation.',
    detectedKomootPage: 'Komoot page detected — Open a tour to launch weather forecasts.',

    // File Upload
    dropzoneText: 'Drag and drop your',
    dropzoneTextAfter: 'file here, or click to browse',
    loadDemoBtn: 'Load demo route',
    demoFileName: 'Demo Loop - Col de Porte & Chartreuse (65 km)',
    demoFileNameShort: 'Demo Loop - Col de Porte (65 km)',

    // Controls
    rideSettings: 'Ride settings',
    calcWeather: 'Calculate weather',
    calculating: 'Calculating...',
    departureTime: 'Departure date & time',
    hourlyForecast: 'Hour-by-hour forecast',
    targetSpeed: 'Target average speed',
    speedStandard: 'standard',
    elevationWeight: 'Elevation weight',
    flat: 'Flat',
    realistic: 'Realistic',
    strict: 'Strict',
    weatherSpacing: 'Weather spacing',
    everyXKm: 'Every {km} km',
    dense: 'dense',
    sparse: 'sparse',

    // Ride Summary
    departureAt: 'Departure at',
    arrivalAt: 'Estimated arrival at',
    distance: 'Distance',
    elevationGain: 'Elevation gain',
    duration: 'Duration',
    avgWind: 'Avg wind',
    maxGusts: 'Max gusts: {val} km/h',
    temperatures: 'Temperatures',
    minMaxRoute: 'Min / Max on route',
    rainRisk: 'Rain risk',
    rainAlertPackJacket: 'Pack a rain jacket 🌧️',
    rainAlertDry: 'Dry weather expected ✨',
    windDistribution: 'Wind breakdown along route:',
    headwindPct: 'Head: {val}%',
    crosswindPct: 'Cross: {val}%',
    tailwindPct: 'Tail: {val}%',

    // Map & Profile
    mapTitle: 'Route map & wind vectors',
    mapHead: 'Headwind',
    mapCross: 'Crosswind',
    mapTail: 'Tailwind',
    profileTitle: 'Elevation profile & weather checkpoints',
    profileSubtitle: 'Hover over curve to explore elevation',
    elevation: 'Elevation',
    grade: 'Slope',
    passingAt: 'Passing:',
    feelsLike: 'feels like',
    precipitation: 'Precipitation:',
    loadingWeather: 'Loading weather...',

    // Weather Timeline
    timelineTitle: 'Step-by-step chronological weather timeline',
    timelineSubtitle: '{count} checkpoints analyzed',
    startPoint: 'START',
    finishPoint: 'FINISH',
    checkpointNum: 'Checkpoint #{idx}',
    riderBearing: 'Rider bearing {bearing}° • Wind {wind}°',
    gustsUpTo: 'Gusts up to {val} km/h',
    headwindResistance: 'Headwind resistance: +{val} km/h',
    tailwindBoost: 'Tailwind boost: {val} km/h',
    lateralWind: 'Crosswind: {val} km/h',

    // In-page Overlay Widget
    widgetCalculating: 'Calculating...',
    widgetHide: 'Hide',
    widgetShow: 'Show',
    widgetAvgWind: 'Avg wind {avg} km/h • Gusts {max} km/h',
    widgetHead: 'Head',
    widgetCross: 'Cross',
    widgetTail: 'Tail',
    widgetSpacing: '📍 Checkpoint spacing',
    widgetSpeed: '⚡ Target speed',
    widgetDeparture: '🕐 Departure date & time',
    widgetPassing: 'Passing:',
    widgetRain: 'Rain:',
    widgetGusts: 'Gusts:',

    // Footer
    weatherBy: 'Weather data provided by',
    mappingBy: 'Mapping ©',
    footerNotice:
      'VeloMétéo is an open-source (MIT) and independent project, not affiliated with Komoot GmbH. Data provided for informational purposes.',
  },
} as const

export type TranslationKey = keyof typeof translations.fr

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  lang: Lang = getBrowserLang()
): string {
  const dict = translations[lang] || translations.fr
  let text: string = dict[key] || translations.fr[key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

export function getWindCategoryLabel(category: WindCategory, lang: Lang = 'fr'): string {
  if (lang === 'en') {
    switch (category) {
      case 'headwind':
        return 'Headwind'
      case 'cross_headwind':
        return '3/4 Headwind'
      case 'crosswind':
        return 'Crosswind'
      case 'cross_tailwind':
        return '3/4 Tailwind'
      case 'tailwind':
        return 'Tailwind'
    }
  }
  switch (category) {
    case 'headwind':
      return 'Vent de face'
    case 'cross_headwind':
      return '3/4 face'
    case 'crosswind':
      return 'Vent de côté'
    case 'cross_tailwind':
      return '3/4 dos'
    case 'tailwind':
      return 'Vent dans le dos'
  }
}

export function getDominantWindLabel(
  headPct: number,
  tailPct: number,
  crossPct: number,
  lang: Lang = 'fr'
): string {
  if (headPct >= 50) {
    return lang === 'en' ? 'Mostly headwind 🔴' : 'Principalement de face 🔴'
  }
  if (tailPct >= 50) {
    return lang === 'en' ? 'Mostly tailwind 🚀' : 'Principalement dans le dos 🚀'
  }
  if (crossPct >= 40) {
    return lang === 'en' ? 'Mostly crosswind 🟡' : 'Principalement de travers 🟡'
  }
  return lang === 'en' ? 'Variable' : 'Variable'
}

export function getWmoWeatherDetails(
  code: number,
  lang: Lang = 'fr'
): { label: string; icon: string } {
  if (lang === 'en') {
    if (code === 0) return { label: 'Sunny / Clear sky', icon: '☀️' }
    if (code === 1) return { label: 'Mainly clear', icon: '🌤️' }
    if (code === 2) return { label: 'Partly cloudy', icon: '⛅' }
    if (code === 3) return { label: 'Overcast', icon: '☁️' }
    if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' }
    if (code >= 51 && code <= 55) return { label: 'Light drizzle', icon: '🌦️' }
    if (code >= 61 && code <= 65) return { label: 'Rain', icon: '🌧️' }
    if (code >= 71 && code <= 77) return { label: 'Snow', icon: '🌨️' }
    if (code >= 80 && code <= 82) return { label: 'Showers', icon: '🌧️' }
    if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: '⛈️' }
    return { label: 'Variable weather', icon: '⛅' }
  }

  if (code === 0) return { label: 'Ensoleillé / Ciel dégagé', icon: '☀️' }
  if (code === 1) return { label: 'Peu nuageux', icon: '🌤️' }
  if (code === 2) return { label: 'Partiellement nuageux', icon: '⛅' }
  if (code === 3) return { label: 'Couvert', icon: '☁️' }
  if (code === 45 || code === 48) return { label: 'Brouillard', icon: '🌫️' }
  if (code >= 51 && code <= 55) return { label: 'Bruine légère', icon: '🌦️' }
  if (code >= 61 && code <= 65) return { label: 'Pluie', icon: '🌧️' }
  if (code >= 71 && code <= 77) return { label: 'Neige', icon: '🌨️' }
  if (code >= 80 && code <= 82) return { label: 'Averses', icon: '🌧️' }
  if (code >= 95 && code <= 99) return { label: 'Orage', icon: '⛈️' }
  return { label: 'Météo variable', icon: '⛅' }
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
