/**
 * Content script VeloMétéo injecté automatiquement dans les pages Komoot (world: 'MAIN')
 * Détecte les parcours, extrait les coordonnées, interroge Open-Meteo
 * et affiche les balises météo ainsi que les sliders de réglage directement sur la carte.
 */

import { computeTrajectoryTiming, generateCheckpoints } from './services/physics'
import { fetchWeatherForCheckpoints, computeRideWeatherSummary, getWmoWeatherDetails } from './services/weather'
import { injectWeatherOnKomootMap, type InjectedWeatherPayload } from './services/komoot-in-page'
import { coordinatesToGpx } from './services/page-detector'
import { parseGpxString } from './services/gpx'
import type { Checkpoint, RideSettings, RouteData, SegmentWeatherSummary } from './types'

function getDefaultDepartureTime(): string {
  const d = new Date()
  // Si consultation en soirée (après 18h), proposer le lendemain matin à 08:30
  if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1)
    d.setHours(8, 30, 0, 0)
  } else {
    // Sinon proposer le prochain créneau de 15 minutes
    const mins = Math.ceil(d.getMinutes() / 15) * 15
    d.setMinutes(mins, 0, 0)
  }
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

let activeTourId: string | null = null
let cachedRoute: RouteData | null = null
let isRunning = false
let currentSettings: RideSettings = {
  departureTime: getDefaultDepartureTime(),
  targetSpeedKmH: 25,
  elevationWeight: 0.7,
  checkpointIntervalKm: 10,
}

function getTourIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/(?:tour|smarttour)\/([r]?\d+)/)
  return match ? match[1] : null
}

function buildPayload(
  checkpoints: Checkpoint[],
  summary: SegmentWeatherSummary,
  settings: RideSettings
): InjectedWeatherPayload {
  return {
    checkpoints: checkpoints.map((cp) => {
      const w = cp.weather
      const wmo = w ? getWmoWeatherDetails(w.weatherCode) : { label: 'Météo', icon: '⛅' }
      return {
        id: cp.id,
        lat: cp.lat,
        lon: cp.lon,
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
        windCategoryLabel: w?.windCategoryLabel ?? 'Vent',
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
    const timings = computeTrajectoryTiming(cachedRoute.points, currentSettings)
    const baseCheckpoints = generateCheckpoints(cachedRoute, currentSettings, timings)
    const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints)
    const summary = computeRideWeatherSummary(withWeather)

    const payload = buildPayload(withWeather, summary, currentSettings)

    // @ts-expect-error global refresh hook
    if (typeof window.__velometeoRefreshMarkers === 'function') {
      // @ts-expect-error global refresh hook
      window.__velometeoRefreshMarkers(payload)
    } else {
      await injectWeatherOnKomootMap(payload, handleSettingsChange)
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur actualisation météo :', err)
  }
}

// Expose au niveau window pour que les sliders puissent l'appeler directement
// @ts-expect-error global hook
window.__velometeoOnSettingsChange = handleSettingsChange

async function runAutoWeather(): Promise<void> {
  const tourId = getTourIdFromUrl()
  if (!tourId) return

  // Évite de ré-exécuter en boucle si déjà injecté sur le même tour
  // @ts-expect-error global flag
  if (window.__velometeoInjectedTour === tourId && document.getElementById('velometeo-komoot-overlay')) {
    return
  }

  if (isRunning) return
  isRunning = true

  try {
    const search = window.location.search
    const coordsUrl = `/api/v007/tours/${tourId}/coordinates${search}`
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
    const tourTitle = rawTitle.replace(/\s*[-|•].*komoot.*$/i, '').trim() || `Tour Komoot #${tourId}`

    const gpxText = coordinatesToGpx(rawItems, tourTitle)
    cachedRoute = parseGpxString(gpxText)

    // 1. Calculs physiques de timing
    const timings = computeTrajectoryTiming(cachedRoute.points, currentSettings)

    // 2. Génération des balises le long du trajet
    const baseCheckpoints = generateCheckpoints(cachedRoute, currentSettings, timings)

    // 3. Récupération des prévisions météo Open-Meteo
    const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints)

    // 4. Synthèse globale de la sortie
    const summary = computeRideWeatherSummary(withWeather)

    // 5. Préparation du payload et injection sur la carte Komoot
    const payload = buildPayload(withWeather, summary, currentSettings)

    const injectRes = await injectWeatherOnKomootMap(payload, handleSettingsChange)
    if (injectRes.success) {
      activeTourId = tourId
      // @ts-expect-error global flag
      window.__velometeoInjectedTour = tourId
    } else {
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

// Surveillance des navigations SPA internes sur Komoot (ex: changement de tour sans rechargement de page)
let lastPath = window.location.pathname
setInterval(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname
    if (getTourIdFromUrl() !== activeTourId) {
      runAutoWeather()
    }
  }
}, 1200)

window.addEventListener('popstate', () => {
  if (getTourIdFromUrl() !== activeTourId) {
    runAutoWeather()
  }
})
