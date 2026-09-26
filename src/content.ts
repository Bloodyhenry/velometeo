/**
 * Content script VeloMétéo injecté automatiquement dans les pages Komoot (world: 'MAIN')
 * Détecte les parcours, extrait les coordonnées, interroge Open-Meteo
 * et affiche les balises météo directement sur la carte sans aucune interaction manuelle.
 */

import { computeTrajectoryTiming, generateCheckpoints } from './services/physics'
import { fetchWeatherForCheckpoints, computeRideWeatherSummary, getWmoWeatherDetails } from './services/weather'
import { injectWeatherOnKomootMap, type InjectedWeatherPayload } from './services/komoot-in-page'
import { coordinatesToGpx } from './services/page-detector'
import { parseGpxString } from './services/gpx'
import type { RideSettings } from './types'

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
let isRunning = false

function getTourIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/(?:tour|smarttour)\/([r]?\d+)/)
  return match ? match[1] : null
}

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
    const route = parseGpxString(gpxText)

    const settings: RideSettings = {
      departureTime: getDefaultDepartureTime(),
      targetSpeedKmH: 25,
      elevationWeight: 0.7,
      checkpointIntervalKm: 10,
    }

    // 1. Calculs physiques de timing
    const timings = computeTrajectoryTiming(route.points, settings)

    // 2. Génération des balises le long du trajet
    const baseCheckpoints = generateCheckpoints(route, settings, timings)

    // 3. Récupération des prévisions météo Open-Meteo
    const withWeather = await fetchWeatherForCheckpoints(baseCheckpoints)

    // 4. Synthèse globale de la sortie
    const summary = computeRideWeatherSummary(withWeather)

    // 5. Préparation du payload et injection sur la carte Komoot
    const payload: InjectedWeatherPayload = {
      checkpoints: withWeather.map((cp) => {
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
      },
    }

    const injectRes = await injectWeatherOnKomootMap(payload)
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
