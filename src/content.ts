/**
 * Content script VeloMétéo injecté automatiquement dans les pages Komoot et Strava (world: 'MAIN')
 * Détecte les parcours et activités, extrait les coordonnées, interroge Open-Meteo
 * et affiche les balises météo ainsi que les sliders de réglage directement sur la carte.
 */

import { computeTrajectoryTiming, generateCheckpoints } from './services/physics'
import { fetchWeatherForCheckpoints, computeRideWeatherSummary, getWmoWeatherDetails } from './services/weather'
import { injectWeatherOnKomootMap, type InjectedWeatherPayload } from './services/komoot-in-page'
import { coordinatesToGpx } from './services/page-detector'
import { parseGpxString } from './services/gpx'
import { getStravaInfoFromUrl, fetchStravaGpx, decodePolyline } from './services/strava'
import { getBrowserLang } from './services/i18n-core'
import type { Checkpoint, RideSettings, RouteData, SegmentWeatherSummary } from './types'

// ponytail: Sniffer réseau activé uniquement sur Strava pour capturer les flux routes/streams en temps réel
if (
  typeof window !== 'undefined' &&
  typeof window.fetch === 'function' &&
  window.location.hostname.includes('strava.')
) {
  const origFetch = window.fetch
  // @ts-expect-error global sniffer flag
  if (!window.__velometeoFetchSnifferInstalled) {
    // @ts-expect-error global sniffer flag
    window.__velometeoFetchSnifferInstalled = true
    window.fetch = async function (...args) {
      const response = await origFetch.apply(this, args)
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || ''
        if (
          response.ok &&
          (url.includes('/routes') ||
            url.includes('/streams') ||
            url.includes('/api/v3/routes'))
        ) {
          const contentType = response.headers?.get('content-type') || ''
          if (contentType.includes('json')) {
            const clone = response.clone()
            clone
              .json()
              .then((data) => {
                if (!data) return
                const poly =
                  data.polyline ||
                  data.summary_polyline ||
                  data.map?.polyline ||
                  data.map?.summary_polyline
                if (poly && typeof poly === 'string') {
                  const pts = decodePolyline(poly)
                  if (pts.length > 2) {
                    // @ts-expect-error global captured route
                    window.__velometeoCapturedRoute = { points: pts, name: data.name || data.title }
                    runAutoWeather()
                  }
                } else if (Array.isArray(data.legs) && data.legs.length > 0) {
                  const pts: Array<{ lat: number; lng: number }> = []
                  for (const leg of data.legs) {
                    const lp =
                      leg.polyline ||
                      leg.summary_polyline ||
                      (typeof leg.geometry === 'string' ? leg.geometry : null)
                    if (lp) pts.push(...decodePolyline(lp))
                  }
                  if (pts.length > 2) {
                    // @ts-expect-error global captured route
                    window.__velometeoCapturedRoute = {
                      points: pts,
                      name:
                        data.name ||
                        (getBrowserLang() === 'en' ? 'Strava route' : 'Itinéraire Strava'),
                    }
                    runAutoWeather()
                  }
                }
              })
              .catch(() => {})
          }
        }
      } catch {}
      return response
    }
  }
}

function getDefaultDepartureTime(): string {
  const d = new Date()
  if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1)
    d.setHours(8, 30, 0, 0)
  } else {
    const mins = Math.ceil(d.getMinutes() / 15) * 15
    d.setMinutes(mins, 0, 0)
  }
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface TourItem {
  platform: 'komoot' | 'strava'
  id: string
  type?: 'route' | 'activity' | 'tour'
}

let activeTourId: string | null = null
let cachedRoute: RouteData | null = null
let cachedPayload: InjectedWeatherPayload | null = null
let isRunning = false
let retryCount = 0
const MAX_RETRIES = 4

let currentSettings: RideSettings = {
  departureTime: getDefaultDepartureTime(),
  targetSpeedKmH: 25,
  elevationWeight: 0.7,
  checkpointIntervalKm: 10,
}

function getCurrentTourItem(): TourItem | null {
  const host = window.location.hostname
  const path = window.location.pathname

  if (/komoot\.(com|de|fr|it|es|nl)/i.test(host)) {
    const match = path.match(/\/(?:tour|smarttour)\/([r]?\d+)/)
    if (match) return { platform: 'komoot', id: match[1], type: 'tour' }
  } else if (/strava\.com/i.test(host)) {
    const info = getStravaInfoFromUrl(path)
    if (info) return { platform: 'strava', id: info.id, type: info.type }
  }
  return null
}

function buildPayload(
  checkpoints: Checkpoint[],
  summary: SegmentWeatherSummary,
  settings: RideSettings
): InjectedWeatherPayload {
  const lang = getBrowserLang()
  return {
    lang,
    checkpoints: checkpoints.map((cp) => {
      const w = cp.weather
      const wmo = w
        ? getWmoWeatherDetails(w.weatherCode, lang)
        : { label: lang === 'en' ? 'Weather' : 'Météo', icon: '⛅' }
      return {
        id: cp.id,
        lat: cp.lat,
        lon: cp.lon,
        bearing: cp.bearing,
        distKm: cp.distKm,
        elevationM: cp.elevationM,
        estimatedTimeStr: cp.estimatedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        temperature: w?.temperature ?? 18,
        apparentTemperature: w?.apparentTemperature ?? 18,
        windSpeed: w?.windSpeed ?? 0,
        windGusts: w?.windGusts ?? 0,
        windDirection: w?.windDirection ?? 0,
        windCategory: w?.windCategory ?? 'headwind',
        windCategoryLabel: w?.windCategoryLabel ?? (lang === 'en' ? 'Wind' : 'Vent'),
        windCategoryColor: w?.windCategoryColor ?? '#64748b',
        weatherIcon: wmo.icon,
        weatherLabel: wmo.label,
        precipitationProb: w?.precipitationProb ?? 0,
        precipitationMm: w?.precipitationMm ?? 0,
        headwindComponent: w?.headwindComponent ?? 0,
        crosswindComponent: w?.crosswindComponent ?? 0,
      }
    }),
    summary,
    settings: {
      departureTime: settings.departureTime,
      targetSpeedKmH: settings.targetSpeedKmH,
      checkpointIntervalKm: settings.checkpointIntervalKm,
      elevationWeight: settings.elevationWeight,
    },
  }
}

async function handleSettingsChange(partial: {
  checkpointIntervalKm?: number
  targetSpeedKmH?: number
  departureTime?: string
}): Promise<void> {
  if (!cachedRoute) return
  currentSettings = { ...currentSettings, ...partial }

  try {
    const lang = getBrowserLang()
    const timings = computeTrajectoryTiming(cachedRoute.points, currentSettings)
    const baseCheckpoints = generateCheckpoints(cachedRoute, currentSettings, timings)
    const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints, lang)
    const summary = computeRideWeatherSummary(withWeather, lang)

    const payload = buildPayload(withWeather, summary, currentSettings)
    cachedPayload = payload

    // @ts-expect-error global refresh hook
    if (typeof window.__velometeoRefreshMarkers === 'function') {
      // @ts-expect-error global refresh hook
      window.__velometeoRefreshMarkers(payload)
    } else {
      await injectWeatherOnKomootMap(payload, handleSettingsChange)
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur actualisation météo :', err)
    // @ts-expect-error global hook
    if (typeof window.__velometeoSetLoading === 'function') {
      // @ts-expect-error global hook
      window.__velometeoSetLoading(false)
    }
  }
}

// @ts-expect-error global hook
window.__velometeoOnSettingsChange = handleSettingsChange

async function runAutoWeather(): Promise<void> {
  const item = getCurrentTourItem()
  if (!item) return

  const itemKey = `${item.platform}-${item.type || 'tour'}-${item.id}`

  // Invalidation au changement de tracé pour ne pas réutiliser le tracé précédent
  if (activeTourId && activeTourId !== itemKey) {
    activeTourId = null
    cachedRoute = null
    cachedPayload = null
    retryCount = 0
    // @ts-expect-error global captured route cleanup
    delete window.__velometeoCapturedRoute
    // @ts-expect-error global captured gpx cleanup
    delete window.__velometeoActiveGpx
  }

  // Évite de ré-exécuter en boucle si déjà injecté sur le même tour ou activité
  // @ts-expect-error global flag
  if (window.__velometeoInjectedTour === itemKey && document.getElementById('velometeo-komoot-overlay')) {
    return
  }

  if (isRunning) return
  isRunning = true

  try {
    // ponytail: Si la météo a déjà été calculée mais que la carte n'était pas prête, réutiliser le payload sans réinterroger Open-Meteo
    if (cachedPayload && cachedRoute) {
      const injectRes = await injectWeatherOnKomootMap(cachedPayload, handleSettingsChange)
      if (injectRes.success) {
        activeTourId = itemKey
        // @ts-expect-error global flag
        window.__velometeoInjectedTour = itemKey
        retryCount = 0
      } else if (retryCount < MAX_RETRIES) {
        retryCount++
        setTimeout(() => {
          if (!document.getElementById('velometeo-komoot-overlay')) {
            runAutoWeather()
          }
        }, 1500)
      }
      return
    }

    let gpxText: string | null = null

    if (item.platform === 'komoot') {
      const search = window.location.search
      const coordsUrl = `/api/v007/tours/${item.id}/coordinates${search}`
      const res = await fetch(coordsUrl, {
        credentials: 'include',
        headers: { Accept: 'application/hal+json,application/json,*/*' },
      })

      if (!res.ok) {
        isRunning = false
        return
      }

      const data = await res.json()
      const rawItems: Array<{ lat: number; lng?: number; lon?: number; alt?: number }> = data?.items
      if (!Array.isArray(rawItems) || rawItems.length < 2) {
        isRunning = false
        return
      }

      const titleEl = document.querySelector('h1')
      const rawTitle = titleEl?.textContent?.trim() || document.title
      const tourTitle = rawTitle.replace(/\s*[-|•].*komoot.*$/i, '').trim() || `Tour Komoot #${item.id}`
      gpxText = coordinatesToGpx(rawItems, tourTitle)
    } else if (item.platform === 'strava') {
      gpxText = await fetchStravaGpx({ id: item.id, type: item.type as 'route' | 'activity' })
    }

    if (!gpxText) {
      // Nouvelle tentative différée bornée à MAX_RETRIES
      if (retryCount < MAX_RETRIES) {
        retryCount++
        setTimeout(() => {
          if (!document.getElementById('velometeo-komoot-overlay')) {
            runAutoWeather()
          }
        }, 1500)
      }
      return
    }

    // @ts-expect-error global cache
    window.__velometeoActiveGpx = gpxText
    const lang = getBrowserLang()
    const headingText = (document.querySelector('h1')?.textContent?.trim() || document.title)
      .replace(/\s*[-|•].*(?:komoot|strava).*$/i, '')
      .trim()
    // @ts-expect-error global cache
    window.__velometeoActiveTourTitle =
      headingText ||
      (item.platform === 'strava'
        ? lang === 'en'
          ? 'Strava route'
          : 'Itinéraire Strava'
        : lang === 'en'
        ? 'Komoot tour'
        : 'Parcours Komoot')

    cachedRoute = parseGpxString(gpxText)

    // 1. Calculs physiques de timing
    const timings = computeTrajectoryTiming(cachedRoute.points, currentSettings)

    // 2. Génération des balises le long du trajet
    const baseCheckpoints = generateCheckpoints(cachedRoute, currentSettings, timings)

    // 3. Récupération des prévisions météo Open-Meteo
    const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints, lang)

    // 4. Synthèse globale de la sortie
    const summary = computeRideWeatherSummary(withWeather, lang)

    // 5. Préparation du payload et injection sur la carte
    const payload = buildPayload(withWeather, summary, currentSettings)
    cachedPayload = payload

    const injectRes = await injectWeatherOnKomootMap(payload, handleSettingsChange)
    if (injectRes.success) {
      activeTourId = itemKey
      // @ts-expect-error global flag
      window.__velometeoInjectedTour = itemKey
      retryCount = 0
    } else if (retryCount < MAX_RETRIES) {
      retryCount++
      console.warn('[VeloMétéo] Carte non encore prête, nouvelle tentative sous peu :', injectRes.message)
      setTimeout(() => {
        if (!document.getElementById('velometeo-komoot-overlay')) {
          runAutoWeather()
        }
      }, 1500)
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur chargement automatique :', err)
  } finally {
    isRunning = false
  }
}

// Initialisation dès que le document est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    runAutoWeather()
  })
} else {
  runAutoWeather()
}

// Surveillance des navigations SPA internes sur Komoot et Strava
let lastPath = window.location.pathname
setInterval(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname
    const current = getCurrentTourItem()
    const itemKey = current ? `${current.platform}-${current.type || 'tour'}-${current.id}` : null
    if (itemKey && itemKey !== activeTourId) {
      runAutoWeather()
    }
  }
}, 1500)

window.addEventListener('popstate', () => {
  const current = getCurrentTourItem()
  const itemKey = current ? `${current.platform}-${current.type || 'tour'}-${current.id}` : null
  if (itemKey && itemKey !== activeTourId) {
    runAutoWeather()
  }
})
