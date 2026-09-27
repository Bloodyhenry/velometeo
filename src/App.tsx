import { useState, useEffect, useCallback } from 'react'
import { Bike, AlertCircle, Compass, ExternalLink } from 'lucide-react'
import type { Checkpoint, RideSettings, RouteData, SegmentWeatherSummary } from './types'
import { parseGpxString } from './services/gpx'
import { computeTrajectoryTiming, generateCheckpoints } from './services/physics'
import {
  computeRideWeatherSummary,
  fetchWeatherForCheckpoints,
} from './services/weather'
import { SAMPLE_GPX_CONTENT } from './services/sample-route'
import {
  detectActiveTourTab,
  extractFromActiveTab,
  injectWeatherIntoKomootTab,
} from './services/page-detector'
import type { DetectedTabInfo } from './services/page-detector'
import { LanguageProvider, useI18n } from './services/i18n'
import { FileUpload } from './components/FileUpload'
import { Controls } from './components/Controls'
import { RideSummary } from './components/RideSummary'
import { RouteMap } from './components/RouteMap'
import { ElevationProfile } from './components/ElevationProfile'
import { WeatherTimeline } from './components/WeatherTimeline'

function getDefaultDepartureTime(): string {
  const d = new Date()
  // Propose demain matin à 08:30 par défaut
  d.setDate(d.getDate() + 1)
  d.setHours(8, 30, 0, 0)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AppContent() {
  const { t, lang, setLang } = useI18n()
  const [route, setRoute] = useState<RouteData | null>(() => {
    try {
      return parseGpxString(SAMPLE_GPX_CONTENT)
    } catch {
      return null
    }
  })
  const [fileName, setFileName] = useState<string>(() => t('demoFileName'))
  const [settings, setSettings] = useState<RideSettings>({
    departureTime: getDefaultDepartureTime(),
    targetSpeedKmH: 25,
    elevationWeight: 0.7,
    checkpointIntervalKm: 10,
  })
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [weatherSummary, setWeatherSummary] = useState<SegmentWeatherSummary | null>(null)
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [detectedTab, setDetectedTab] = useState<DetectedTabInfo | null>(null)

  // Calcule la physique et interroge Open-Meteo pour la trace courante
  const processRouteAndWeather = useCallback(
    async (currentRoute: RouteData, currentSettings: RideSettings) => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        // 1. Calcul de la physique et des horaires d'arrivée par segment
        const timings = computeTrajectoryTiming(currentRoute.points, currentSettings)

        // 2. Génération des checkpoints
        const baseCheckpoints = generateCheckpoints(currentRoute, currentSettings, timings)

        // 3. Appel de l'API météo Open-Meteo
        const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints, lang)

        setCheckpoints(withWeather)

        // 4. Synthèse globale
        const summary = computeRideWeatherSummary(withWeather, lang)
        setWeatherSummary(summary)
      } catch (err: unknown) {
        console.error('Erreur traitement météo :', err)
        const msg = err instanceof Error ? err.message : t('unexpectedError')
        setErrorMessage(msg)
      } finally {
        setIsLoading(false)
      }
    },
    [lang, t]
  )

  // ponytail: Synchronise le titre de démo et les synthèses dynamiques au changement de langue
  useEffect(() => {
    setFileName((prev) => {
      if (
        prev === 'Boucle Démo - Col de Porte & Chartreuse (65 km)' ||
        prev === 'Demo Loop - Col de Porte & Chartreuse (65 km)' ||
        prev === 'Boucle Démo - Col de Porte (65 km)' ||
        prev === 'Demo Loop - Col de Porte (65 km)'
      ) {
        return t('demoFileName')
      }
      return prev
    })

    if (checkpoints.length > 0) {
      setWeatherSummary(computeRideWeatherSummary(checkpoints, lang))
    }
  }, [lang, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement d'une trace GPX (upload ou démo)
  const handleGpxLoaded = useCallback(
    (gpxContent: string, name: string) => {
      try {
        setErrorMessage(null)
        const parsed = parseGpxString(gpxContent)
        setRoute(parsed)
        setFileName(name)
        processRouteAndWeather(parsed, settings)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t('gpxReadError')
        setErrorMessage(msg)
      }
    },
    [processRouteAndWeather, settings, t]
  )

  const scanActiveTab = useCallback(async () => {
    try {
      const tabInfo = await detectActiveTourTab()
      setDetectedTab(tabInfo)
      // Auto-import immédiat si un tour Komoot est détecté sur l'onglet actif
      if (tabInfo && tabInfo.tourId) {
        const res = await extractFromActiveTab(tabInfo)
        if (res.success && res.gpxContent) {
          handleGpxLoaded(
            res.gpxContent,
            res.tourName || tabInfo.title || (lang === 'en' ? 'Komoot tour' : 'Parcours Komoot')
          )
        }
      }
    } catch (e) {
      console.warn("Erreur lors de l'analyse de l'onglet actif :", e)
    }
  }, [handleGpxLoaded, lang])

  useEffect(() => {
    if (route) {
      processRouteAndWeather(route, settings)
    }
    scanActiveTab()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Projection automatique sur la carte Komoot dès que les calculs météo sont prêts
  useEffect(() => {
    if (detectedTab?.tabId && checkpoints.length > 0 && weatherSummary) {
      injectWeatherIntoKomootTab(
        detectedTab.tabId,
        checkpoints,
        settings,
        weatherSummary,
        lang
      ).catch((err) => {
        console.warn('Erreur projection automatique Komoot :', err)
      })
    }
  }, [checkpoints, weatherSummary, detectedTab?.tabId, settings, lang])

  // Rafraîchissement manuel ou modification de paramètres
  const handleSettingsChange = (newSettings: RideSettings) => {
    setSettings(newSettings)
    if (route) {
      processRouteAndWeather(route, newSettings)
    }
  }

  const handleManualRefresh = () => {
    if (route) {
      processRouteAndWeather(route, settings)
    }
  }

  const departureDate = new Date(settings.departureTime)
  const arrivalDate =
    checkpoints.length > 0
      ? checkpoints[checkpoints.length - 1].estimatedTime
      : new Date(departureDate.getTime() + 3 * 3600 * 1000)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* Header supérieur */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                {t('appName')}{' '}
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {t('appBadge')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{t('appSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            {/* Sélecteur de langue multilingue FR / EN */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  lang === 'fr'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Passer en français"
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                // @ts-expect-error chrome runtime check
                if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
                  // @ts-expect-error chrome runtime
                  chrome.tabs.create({ url: 'index.html' })
                } else {
                  window.open(window.location.href, '_blank')
                }
              }}
              title={t('fullScreenTitle')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('fullScreen')}</span>
            </button>
            <span className="hidden md:flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-blue-500" /> Open-Meteo
            </span>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Alerte erreur éventuelle */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">{t('errorOccurred')}</h3>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* En-tête si un tour Komoot est détecté, ou upload & sliders en mode autonome GPX */}
        {detectedTab ? (
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shrink-0">
                🚴
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">
                  {fileName || detectedTab.title}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detectedTab.tourId &&
                  detectedTab.tourId !== 'builder' &&
                  detectedTab.tourId !== 'activity'
                    ? detectedTab.platform === 'strava'
                      ? t('syncDescStrava')
                      : t('syncDescKomoot')
                    : detectedTab.platform === 'strava'
                    ? t('detectedStravaPage')
                    : t('detectedKomootPage')}
                </p>
              </div>
            </div>
            {route && checkpoints.length > 0 && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shrink-0">
                {t('activeOnMap')}
              </span>
            )}
          </div>
        ) : (
          <>
            <FileUpload onGpxLoaded={handleGpxLoaded} isLoading={isLoading} />
            {/* Paramètres de simulation en mode autonome GPX */}
            <Controls
              settings={settings}
              onChange={handleSettingsChange}
              onRefresh={handleManualRefresh}
              isLoading={isLoading}
            />
          </>
        )}

        {/* 3. Synthèse de la sortie & jauge de vent */}
        {route && weatherSummary && (
          <RideSummary
            route={route}
            checkpoints={checkpoints}
            weatherSummary={weatherSummary}
            departureDate={departureDate}
            arrivalDate={arrivalDate}
          />
        )}

        {/* 4. Cartographie & Profil altimétrique synchronisé */}
        {route && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RouteMap
              route={route}
              checkpoints={checkpoints}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={(id) => setSelectedCheckpointId(id)}
            />

            <ElevationProfile
              points={route.points}
              checkpoints={checkpoints}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={(id) => setSelectedCheckpointId(id)}
            />
          </div>
        )}

        {/* 5. Déroulé chronologique étape par étape */}
        {checkpoints.length > 0 && (
          <WeatherTimeline
            checkpoints={checkpoints}
            selectedCheckpointId={selectedCheckpointId}
            onSelectCheckpoint={(id) => setSelectedCheckpointId(id)}
          />
        )}
      </main>

      {/* Footer d'attributions légales et mentions de responsabilité */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t border-slate-200/80 text-center text-xs text-slate-400 space-y-1.5">
        <p>
          {t('weatherBy')}{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
          >
            Open-Meteo (CC BY 4.0)
          </a>{' '}
          • {t('mappingBy')}{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
          >
            OpenStreetMap
          </a>
        </p>
        <p>{t('footerNotice')}</p>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App
