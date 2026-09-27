/**
 * Service d'extraction des parcours et activités Strava.
 * Supporte :
 * 1. Export GPX officiel authentifié (/routes/{id}/export_gpx et /activities/{id}/export_gpx)
 * 2. Flux streams de points d'activité (/activities/{id}/streams)
 * 3. Données in-page Backbone (window.pageView)
 * 4. Données in-page React Fiber (prefetchedRoute, legs, track, polyline)
 * 5. Données Next.js (__NEXT_DATA__)
 * 6. Extraction vectorielle GeoJSON depuis les couches Mapbox GL / MapLibre de la page
 * 7. Décodage polyline / JSON embarqué dans les scripts DOM
 */

import { coordinatesToGpx } from './page-detector'

export interface StravaItemInfo {
  id: string
  type: 'route' | 'activity'
}

export function getStravaInfoFromUrl(pathname: string = window.location.pathname): StravaItemInfo | null {
  // Support /routes/123456, /athlete/routes/123456, /maps/routes/123456
  const routeMatch = pathname.match(/(?:\/routes\/|\/athlete\/routes\/|\/maps\/routes\/)([r]?\d+)/)
  if (routeMatch) return { id: routeMatch[1], type: 'route' }

  // Support /activities/123456
  const activityMatch = pathname.match(/\/activities\/([r]?\d+)/)
  if (activityMatch) return { id: activityMatch[1], type: 'activity' }

  // Support Strava Route Builder / Maps sans ID numérique (/routes, /routes/, /routes/new, /maps, /athlete/routes)
  if (pathname.includes('/routes') || pathname === '/maps' || pathname.startsWith('/maps/')) {
    return { id: 'builder', type: 'route' }
  }

  // Support pages d'activités génériques (/activities, /activities/)
  if (pathname.includes('/activities')) {
    return { id: 'activity', type: 'activity' }
  }

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

  // 0. TENTATIVE IMMÉDIATE : Tracé intercepté en direct par le sniffer réseau
  try {
    const win = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    if (win.__velometeoCapturedRoute && Array.isArray(win.__velometeoCapturedRoute.points) && win.__velometeoCapturedRoute.points.length > 1) {
      return coordinatesToGpx(win.__velometeoCapturedRoute.points, win.__velometeoCapturedRoute.name || defaultTitle)
    }
  } catch {}

  // 1. TENTATIVE IMMÉDIATE : Export GPX officiel authentifié (si ID numérique présent)
  if (info.id !== 'builder' && info.id !== 'activity') {
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
        if (text.includes('<gpx') && text.includes('</gpx>')) {
          return text
        }
      }
    } catch (err) {
      console.warn('[VeloMétéo] Export GPX direct non accessible :', err)
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
  }

  // 3. FALLBACK DONNÉES EN MÉMOIRE BACKBONE (window.pageView)
  try {
    const win = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    if (win.pageView) {
      if (typeof win.pageView.streams === 'function') {
        const s = win.pageView.streams()
        const latlng = s.getStream?.('latlng') || s.streamData?.latlng
        const alt = s.getStream?.('altitude') || s.streamData?.altitude
        if (Array.isArray(latlng) && latlng.length > 1) {
          const items = latlng.map((pt: [number, number], idx: number) => ({
            lat: pt[0],
            lng: pt[1],
            alt: alt?.[idx] || 0,
          }))
          return coordinatesToGpx(items, defaultTitle)
        }
      }
    }
  } catch {}

  // 4. FALLBACK REACT FIBER (prefetchedRoute, legs, track, route)
  try {
    const searchElements = [
      document.querySelector('canvas'),
      document.querySelector('[class*="CoreMap"]'),
      document.querySelector('[class*="Map_map"]'),
      document.getElementById('explore-map'),
      document.getElementById('root'),
      document.body,
    ].filter(Boolean) as HTMLElement[]

    for (const el of searchElements) {
      const fiberKey = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
      )
      let curr = fiberKey ? (el as any)[fiberKey] : null // eslint-disable-line @typescript-eslint/no-explicit-any
      let depth = 0
      while (curr && depth < 80) {
        const p = curr.memoizedProps
        if (p) {
          // A. prefetchedRoute
          const pr = p.prefetchedRoute || p.route
          if (pr) {
            const poly = pr.polyline || pr.summary_polyline || pr.map?.polyline || pr.map?.summary_polyline
            if (poly && typeof poly === 'string') {
              const decoded = decodePolyline(poly)
              if (decoded.length > 2) return coordinatesToGpx(decoded, pr.name || defaultTitle)
            }
            if (Array.isArray(pr.coordinates) && pr.coordinates.length > 1) {
              return coordinatesToGpx(pr.coordinates, pr.name || defaultTitle)
            }
          }

          // B. legs (Strava Route Builder / Maps)
          if (Array.isArray(p.legs) && p.legs.length > 0) {
            const allPoints: Array<{ lat: number; lng: number; alt?: number }> = []
            for (const leg of p.legs) {
              const legPoly = leg.polyline || leg.summary_polyline || (typeof leg.geometry === 'string' ? leg.geometry : null)
              if (legPoly) {
                allPoints.push(...decodePolyline(legPoly))
              } else if (Array.isArray(leg.points)) {
                for (const pt of leg.points) {
                  if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
                    allPoints.push(pt)
                  } else if (Array.isArray(pt) && pt.length >= 2) {
                    allPoints.push({ lat: pt[0], lng: pt[1], alt: pt[2] })
                  }
                }
              } else if (Array.isArray(leg.coordinates)) {
                for (const pt of leg.coordinates) {
                  if (Array.isArray(pt) && pt.length >= 2) {
                    allPoints.push({ lat: pt[1], lng: pt[0], alt: pt[2] })
                  }
                }
              }
            }
            if (allPoints.length > 1) {
              return coordinatesToGpx(allPoints, defaultTitle)
            }
          }

          // C. route ou track ou activity direct
          const cand = p.track || p.activity || p.currentRoute
          if (cand) {
            const poly = cand.polyline || cand.summary_polyline || cand.map?.polyline || cand.map?.summary_polyline
            if (poly && typeof poly === 'string') {
              const decoded = decodePolyline(poly)
              if (decoded.length > 2) return coordinatesToGpx(decoded, cand.name || defaultTitle)
            }
          }
        }
        curr = curr.return
        depth++
      }
    }
  } catch {}

  // 5. FALLBACK NEXT.js DATA (__NEXT_DATA__)
  try {
    const nextData = document.getElementById('__NEXT_DATA__')
    if (nextData) {
      const json = JSON.parse(nextData.textContent || '{}')
      const pageProps = json?.props?.pageProps
      if (pageProps) {
        const pr = pageProps.prefetchedRoute || pageProps.route || pageProps.activity
        if (pr) {
          const poly = pr.polyline || pr.summary_polyline || pr.map?.summary_polyline
          if (poly && typeof poly === 'string') {
            const decoded = decodePolyline(poly)
            if (decoded.length > 2) return coordinatesToGpx(decoded, pr.name || pageProps.routeName || defaultTitle)
          }
        }
      }
    }
  } catch {}

  // 6. FALLBACK COUCHES VECTORIELLES MAPBOX GL / MAPLIBRE
  try {
    const win = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const map = win.stravaMap || win.komootMap || win.map || win.__map || win.__velometeoCapturedMap
    if (map && typeof map.getStyle === 'function') {
      const style = map.getStyle()
      if (style && style.sources) {
        for (const sId of Object.keys(style.sources)) {
          const src = map.getSource(sId)
          const data = src?._data || src?.data
          if (data) {
            if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
              for (const f of data.features) {
                if (f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 1) {
                  const items = f.geometry.coordinates.map((c: [number, number, number?]) => ({
                    lng: c[0],
                    lat: c[1],
                    alt: c[2] || 0,
                  }))
                  return coordinatesToGpx(items, defaultTitle)
                }
              }
            }
            if (data.geometry?.type === 'LineString' && Array.isArray(data.geometry.coordinates) && data.geometry.coordinates.length > 1) {
              const items = data.geometry.coordinates.map((c: [number, number, number?]) => ({
                lng: c[0],
                lat: c[1],
                alt: c[2] || 0,
              }))
              return coordinatesToGpx(items, defaultTitle)
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur lecture sources Mapbox Strava :', err)
  }

  // 7. FALLBACK SCRIPTS DOM (polylines et JSON embarqués dans la page)
  try {
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const s of scripts) {
      const text = s.textContent || ''
      if (text.includes('summary_polyline') || text.includes('"polyline"') || text.includes('"coordinates"')) {
        const polyMatch = text.match(/"(?:summary_)?polyline"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (polyMatch && polyMatch[1]) {
          try {
            const rawPoly = JSON.parse(`"${polyMatch[1]}"`)
            const decoded = decodePolyline(rawPoly)
            if (decoded.length > 2) {
              return coordinatesToGpx(decoded, defaultTitle)
            }
          } catch {}
        }

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
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[VeloMétéo] Erreur lecture scripts DOM Strava :', err)
  }

  return null
}
