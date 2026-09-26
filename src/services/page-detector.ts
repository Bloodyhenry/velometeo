import type { Checkpoint, RideSettings, SegmentWeatherSummary } from '../types'
import { getWmoWeatherDetails } from './weather'
import { injectWeatherOnKomootMap, type InjectedWeatherPayload } from './komoot-in-page'

export interface DetectedTabInfo {
  tabId: number
  platform: 'komoot' | 'strava' | 'unknown'
  url: string
  title: string
  tourId?: string
}

export interface ExtractionResult {
  success: boolean
  gpxContent?: string
  tourName?: string
  error?: string
}

/**
 * Convertit un tableau de coordonnées brutes ({lat, lng, alt}) en fichier GPX standard.
 */
export function coordinatesToGpx(
  items: Array<{ lat: number; lng?: number; lon?: number; alt?: number; ele?: number }>,
  tourName: string = 'Parcours Komoot'
): string {
  const validItems = items.filter(
    (pt) =>
      typeof pt.lat === 'number' &&
      (typeof pt.lng === 'number' || typeof pt.lon === 'number')
  )

  if (validItems.length < 2) {
    throw new Error('Moins de 2 coordonnées GPS valides trouvées.')
  }

  const trkpts = validItems
    .map((pt) => {
      const lon = pt.lng !== undefined ? pt.lng : pt.lon!
      const ele = Math.round(pt.alt !== undefined ? pt.alt : pt.ele || 0)
      return `    <trkpt lat="${pt.lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele}</ele></trkpt>`
    })
    .join('\n')

  const safeName = tourName.replace(/[<>&"']/g, '').trim() || 'Trace Komoot'

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VeloMeteo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

/**
 * Fonction exécutée directement dans le contexte de la page Komoot (world: 'MAIN')
 * pour extraire les coordonnées du parcours depuis l'API de session, la carte Mapbox, ou le DOM.
 */
export async function extractKomootInPage(): Promise<{
  success: boolean
  items?: Array<{ lat: number; lng?: number; lon?: number; alt?: number }>
  title?: string
  error?: string
}> {
  try {
    const pathname = window.location.pathname
    const search = window.location.search // Contient les paramètres comme ?share_token=...

    // 1. Extraction de l'ID du tour dans l'URL (/tour/123456 ou /smarttour/123456 ou /plan/tour/123456)
    const match = pathname.match(/\/(?:tour|smarttour)\/([r]?\d+)/)
    const tourId = match ? match[1] : null

    const titleEl = document.querySelector('h1')
    const rawTitle = titleEl?.textContent?.trim() || document.title
    const tourTitle = rawTitle.replace(/\s*[-|•].*komoot.*$/i, '').trim() || 'Parcours Komoot'

    // Stratégie 1 : Appel direct à l'API interne Komoot avec conservation du share_token et des cookies
    if (tourId) {
      try {
        const coordsUrl = `/api/v007/tours/${tourId}/coordinates${search}`
        const res = await fetch(coordsUrl, {
          credentials: 'include',
          headers: { Accept: 'application/hal+json,application/json,*/*' },
        })
        if (res.ok) {
          const json = await res.json()
          if (json && Array.isArray(json.items) && json.items.length > 1) {
            return {
              success: true,
              title: tourTitle,
              items: json.items,
            }
          }
        }
      } catch {
        // En cas d'échec réseau, on continue avec les autres stratégies
      }

      // Stratégie 2 : Appel à l'objet complet du tour avec le share_token
      try {
        const tourUrl = `/api/v007/tours/${tourId}${search ? search + '&_embedded=coordinates' : '?_embedded=coordinates'}`
        const resTour = await fetch(tourUrl, {
          credentials: 'include',
          headers: { Accept: 'application/hal+json,application/json,*/*' },
        })
        if (resTour.ok) {
          const jsonTour = await resTour.json()
          const items =
            jsonTour?._embedded?.coordinates?.items ||
            jsonTour?.coordinates?.items
          if (Array.isArray(items) && items.length > 1) {
            return {
              success: true,
              title: jsonTour.name || tourTitle,
              items,
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // Stratégie 3 : Extraction directe depuis la carte Mapbox GL affichée sur la page
    try {
      const mapCandidates: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any

      // Recherche des instances globales Mapbox
      // @ts-expect-error Mapbox global checks
      if (window.map && typeof window.map.getStyle === 'function') mapCandidates.push(window.map)
      // @ts-expect-error Mapbox global checks
      if (window.__map && typeof window.__map.getStyle === 'function') mapCandidates.push(window.__map)

      // Recherche via les éléments DOM de la carte (canvas MapLibre / Mapbox ou conteneur)
      const canvasEl = document.querySelector('canvas.maplibregl-canvas, canvas.mapboxgl-canvas, .maplibregl-canvas-container canvas, canvas') as HTMLCanvasElement | null
      const mapContainerEl = canvasEl?.closest('.maplibregl-canvas-container')?.parentElement || canvasEl?.parentElement
      const mapElements = [canvasEl, canvasEl?.parentElement, mapContainerEl, document.querySelector('.mapboxgl-map, .maplibregl-map')].filter(Boolean) as any[]

      for (const el of mapElements) {
        if (el._mapboxgl) mapCandidates.push(el._mapboxgl)
        if (el.__map) mapCandidates.push(el.__map)
        if (el._map) mapCandidates.push(el._map)

        // Exploration de l'arborescence React Fiber
        const fiberKey = Object.keys(el).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        )
        if (fiberKey) {
          let curr = el[fiberKey]
          let depth = 0
          while (curr && depth < 40) {
            const props = curr.memoizedProps
            if (props) {
              if (Array.isArray(props.coordinates) && props.coordinates.length > 1) {
                return { success: true, title: tourTitle, items: props.coordinates }
              }
              const tourCoords = props.tour?._embedded?.coordinates?.items
              if (Array.isArray(tourCoords) && tourCoords.length > 1) {
                return { success: true, title: props.tour?.name || tourTitle, items: tourCoords }
              }
              if (props.map && typeof props.map.getStyle === 'function') {
                mapCandidates.push(props.map)
              }
              if (props.value?.map && typeof props.value.map.getStyle === 'function') {
                mapCandidates.push(props.value.map)
              }
            }
            curr = curr.return
            depth++
          }
        }
      }

      // Inspection des sources GeoJSON de la carte Mapbox
      for (const map of mapCandidates) {
        const style = map.getStyle ? map.getStyle() : null
        if (style && style.sources) {
          for (const sId in style.sources) {
            const src = style.sources[sId]
            const data = src?.data
            if (data) {
              // FeatureCollection
              if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
                for (const f of data.features) {
                  if (f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)) {
                    const coords = f.geometry.coordinates.map((c: [number, number, number?]) => ({
                      lon: c[0],
                      lat: c[1],
                      alt: c[2] || 0,
                    }))
                    if (coords.length > 2) {
                      return { success: true, title: tourTitle, items: coords }
                    }
                  }
                }
              }
              // Feature
              if (data.geometry?.type === 'LineString' && Array.isArray(data.geometry.coordinates)) {
                const coords = data.geometry.coordinates.map((c: [number, number, number?]) => ({
                  lon: c[0],
                  lat: c[1],
                  alt: c[2] || 0,
                }))
                if (coords.length > 2) {
                  return { success: true, title: tourTitle, items: coords }
                }
              }
            }
          }
        }
      }
    } catch {
      // Poursuivre vers stratégie script tags
    }

    // Stratégie 4 : Inspection des balises <script> pour kmtBoot.setProps ou __INITIAL_STATE__
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const s of scripts) {
      const text = s.textContent || ''
      if (text.includes('kmtBoot.setProps')) {
        const firstQuote = text.indexOf('"')
        const lastQuote = text.lastIndexOf('"')
        if (firstQuote !== -1 && lastQuote > firstQuote) {
          try {
            const unescaped = JSON.parse(text.slice(firstQuote, lastQuote + 1))
            const data = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped
            const items =
              data?.page?.data?.tour?._embedded?.coordinates?.items ||
              data?.tour?._embedded?.coordinates?.items ||
              data?.tour?.coordinates?.items ||
              data?._embedded?.coordinates?.items ||
              data?.items
            if (Array.isArray(items) && items.length > 1) {
              const name = data?.page?.data?.tour?.name || data?.tour?.name || tourTitle
              return { success: true, title: name, items }
            }
          } catch {
            // Continuer la boucle
          }
        }
      }
    }

    if (!tourId) {
      return {
        success: false,
        error:
          "Aucun identifiant de parcours détecté dans l'URL. Veuillez ouvrir la page d'un tour Komoot spécifique (ex: komoot.com/tour/...)",
      }
    }

    return {
      success: false,
      error:
        "Impossible de récupérer les coordonnées du tour sur cette page Komoot. Vérifiez que la page a fini de charger.",
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

/**
 * Détecte si l'onglet actif est une page de parcours (Komoot, etc.)
 */
export async function detectActiveTourTab(): Promise<DetectedTabInfo | null> {
  // @ts-expect-error chrome extension API
  if (typeof chrome === 'undefined' || !chrome?.tabs?.query) {
    return null
  }

  try {
    // @ts-expect-error chrome extension API
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.id || !tab.url) return null

    const url = tab.url
    if (/komoot\.(com|de|fr|it|es|nl)\//i.test(url)) {
      const match = url.match(/\/(?:tour|smarttour)\/([r]?\d+)/)
      return {
        tabId: tab.id,
        platform: 'komoot',
        url,
        title: tab.title || 'Komoot',
        tourId: match ? match[1] : undefined,
      }
    }

    return null
  } catch (err) {
    console.warn('Erreur lors de la détection de l’onglet actif :', err)
    return null
  }
}

/**
 * Déclenche l'extraction du parcours sur l'onglet actif et le convertit en GPX.
 * Combine un fetch direct depuis le contexte de l'extension (avec host_permissions et share_token)
 * et une injection dans la page si nécessaire.
 */
export async function extractFromActiveTab(
  tabInfo: DetectedTabInfo
): Promise<ExtractionResult> {
  // 1. TENTATIVE IMMÉDIATE : Fetch direct depuis l'extension (rapide, conserve les query params dont share_token)
  if (tabInfo.tourId) {
    try {
      const parsedUrl = new URL(tabInfo.url)
      const directUrl = `https://${parsedUrl.hostname}/api/v007/tours/${tabInfo.tourId}/coordinates${parsedUrl.search}`
      const directRes = await fetch(directUrl, {
        headers: { Accept: 'application/hal+json,application/json,*/*' },
      })
      if (directRes.ok) {
        const data = await directRes.json()
        if (data && Array.isArray(data.items) && data.items.length > 1) {
          const gpx = coordinatesToGpx(data.items, tabInfo.title || 'Parcours Komoot')
          return {
            success: true,
            gpxContent: gpx,
            tourName: tabInfo.title || 'Parcours Komoot',
          }
        }
      }
    } catch (e) {
      console.warn("Tentative de fetch direct échouée, passage à l'injection page :", e)
    }
  }

  // 2. TENTATIVE CONTEXTE PAGE (Injected Script world: 'MAIN')
  // @ts-expect-error chrome extension API
  if (typeof chrome === 'undefined' || !chrome?.scripting?.executeScript) {
    return {
      success: false,
      error: "L'API d'extension de navigateur n'est pas accessible.",
    }
  }

  try {
    // Exécution du script directement dans le contexte de la page Komoot (world: 'MAIN')
    // @ts-expect-error chrome extension API
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tabInfo.tabId },
      world: 'MAIN',
      func: extractKomootInPage,
    })

    const result = injectionResults?.[0]?.result
    if (!result || !result.success || !result.items) {
      return {
        success: false,
        error: result?.error || "Échec de l'extraction des coordonnées du tour Komoot.",
      }
    }

    const gpx = coordinatesToGpx(result.items, result.title || tabInfo.title || 'Parcours Komoot')
    return {
      success: true,
      gpxContent: gpx,
      tourName: result.title || tabInfo.title || 'Parcours Komoot',
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'injection du script"
    return {
      success: false,
      error: `Erreur d'accès à la page : ${msg}. Assurez-vous d'avoir rechargé l'extension.`,
    }
  }
}

/**
 * Projette les balises météo et le widget directement sur la carte de la page Komoot.
 */
export async function injectWeatherIntoKomootTab(
  tabId: number,
  checkpoints: Checkpoint[],
  settings: RideSettings,
  summary: SegmentWeatherSummary
): Promise<{ success: boolean; message?: string }> {
  // @ts-expect-error chrome extension API
  if (typeof chrome === 'undefined' || !chrome?.scripting?.executeScript) {
    return { success: false, message: "L'API chrome.scripting n'est pas disponible." }
  }

  const payload: InjectedWeatherPayload = {
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
    },
  }

  try {
    // @ts-expect-error chrome extension API
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectWeatherOnKomootMap,
      args: [payload],
    })

    return injectionResults?.[0]?.result || { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, message: msg }
  }
}

