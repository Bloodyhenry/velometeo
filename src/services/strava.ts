/**
 * Service d'extraction des parcours et activités Strava.
 * Supporte :
 * 1. Export GPX officiel authentifié (/routes/{id}/export_gpx et /activities/{id}/export_gpx)
 * 2. Flux streams de points d'activité (/activities/{id}/streams)
 * 3. Extraction vectorielle GeoJSON depuis les couches Mapbox GL de la page
 * 4. Décodage polyline / JSON embarqué dans les scripts DOM
 */

import { coordinatesToGpx } from './page-detector'

export interface StravaItemInfo {
  id: string
  type: 'route' | 'activity'
}

export function getStravaInfoFromUrl(pathname: string = window.location.pathname): StravaItemInfo | null {
  const routeMatch = pathname.match(/\/routes\/([r]?\d+)/)
  if (routeMatch) return { id: routeMatch[1], type: 'route' }

  const activityMatch = pathname.match(/\/activities\/([r]?\d+)/)
  if (activityMatch) return { id: activityMatch[1], type: 'activity' }

  return null
}

/**
 * Décode une chaîne polyline compressée (algorithme standard Google / Mapbox / Strava).
 * ponytail: algorithme sans dépendance externe, O(N), conversion pure bitwise.
 */
export function decodePolyline(str: string): Array<{ lat: number; lng: number }> {
  let index = 0
  const len = str.length
  let lat = 0
  let lng = 0
  const coordinates: Array<{ lat: number; lng: number }> = []

  while (index < len) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push({
      lat: Math.round(lat * 1e-5 * 1e6) / 1e6,
      lng: Math.round(lng * 1e-5 * 1e6) / 1e6,
    })
  }
  return coordinates
}

export async function fetchStravaGpx(info: StravaItemInfo): Promise<string | null> {
  const titleEl = document.querySelector('h1')
  const defaultTitle = titleEl?.textContent?.trim() || (info.type === 'route' ? `Itinéraire Strava #${info.id}` : `Activité Strava #${info.id}`)

  // 1. TENTATIVE IMMÉDIATE : Export GPX officiel avec conservation des cookies de session
  const exportUrl = info.type === 'route'
    ? `/routes/${info.id}/export_gpx`
    : `/activities/${info.id}/export_gpx`

  try {
    const res = await fetch(exportUrl, {
      credentials: 'include',
      headers: {
        Accept: 'application/gpx+xml,application/xml,text/xml,*/*',
      },
    })
    if (res.ok) {
      const text = await res.text()
      // Vérification que c'est un flux GPX XML valide et non une page HTML de redirection/login
      if (text.includes('<gpx') && text.includes('</gpx>')) {
        return text
      }
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur fetch export GPX Strava :', err)
  }

  // 2. FALLBACK ACTIVITÉ : API streams Strava (latlng + altitude)
  if (info.type === 'activity') {
    try {
      const streamsUrl = `/activities/${info.id}/streams?stream_types[]=latlng&stream_types[]=altitude&stream_types[]=distance`
      const streamsRes = await fetch(streamsUrl, {
        credentials: 'include',
        headers: { Accept: 'application/json,*/*' },
      })
      if (streamsRes.ok) {
        const json = await streamsRes.json()
        const latlngStream = Array.isArray(json)
          ? json.find((s: any) => s.type === 'latlng')?.data // eslint-disable-line @typescript-eslint/no-explicit-any
          : json?.latlng?.data
        const altStream = Array.isArray(json)
          ? json.find((s: any) => s.type === 'altitude')?.data // eslint-disable-line @typescript-eslint/no-explicit-any
          : json?.altitude?.data

        if (Array.isArray(latlngStream) && latlngStream.length > 1) {
          const items = latlngStream.map((pt: [number, number], idx: number) => ({
            lat: pt[0],
            lng: pt[1],
            alt: altStream?.[idx] || 0,
          }))
          return coordinatesToGpx(items, defaultTitle)
        }
      }
    } catch (err) {
      console.warn('[VeloMétéo] Erreur streams Strava :', err)
    }
  }

  // 3. FALLBACK MAPBOX GL / MAPLIBRE : Extraction depuis les sources vectorielles de la carte
  try {
    const win = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const map = win.stravaMap || win.komootMap || win.map || win.__map || win.__velometeoCapturedMap
    if (map && typeof map.getSource === 'function') {
      const candidateSources = ['route', 'activity', 'segment', 'track', 'polyline', 'composite']
      for (const sourceId of candidateSources) {
        const src = map.getSource(sourceId)
        const data = src?._data || src?.data
        const coords = data?.geometry?.coordinates || data?.features?.[0]?.geometry?.coordinates
        if (Array.isArray(coords) && coords.length > 1) {
          const items = coords.map((c: [number, number, number?]) => ({
            lng: c[0],
            lat: c[1],
            alt: c[2] || 0,
          }))
          return coordinatesToGpx(items, defaultTitle)
        }
      }
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur lecture Mapbox Strava :', err)
  }

  // 4. FALLBACK SCRIPTS DOM (polylines et JSON embarqués dans la page)
  try {
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const s of scripts) {
      const text = s.textContent || ''
      if (text.includes('summary_polyline') || text.includes('"polyline"') || text.includes('"coordinates"')) {
        // Extraction summary_polyline ou polyline
        const polyMatch = text.match(/"(?:summary_)?polyline"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (polyMatch && polyMatch[1]) {
          try {
            const rawPoly = JSON.parse(`"${polyMatch[1]}"`)
            const decoded = decodePolyline(rawPoly)
            if (decoded.length > 2) {
              return coordinatesToGpx(decoded, defaultTitle)
            }
          } catch {
            // Continuer
          }
        }

        // Extraction direct d'un tableau [[lng, lat], ...]
        const coordsMatch = text.match(/"coordinates"\s*:\s*(\[\[[\s\S]*?\]\])/)
        if (coordsMatch && coordsMatch[1]) {
          try {
            const coords = JSON.parse(coordsMatch[1])
            if (Array.isArray(coords) && coords.length > 2) {
              const items = coords.map((c: [number, number, number?]) => ({
                lng: c[0],
                lat: c[1],
                alt: c[2] || 0,
              }))
              return coordinatesToGpx(items, defaultTitle)
            }
          } catch {
            // Continuer
          }
        }
      }
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur lecture scripts DOM Strava :', err)
  }

  return null
}
