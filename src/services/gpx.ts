import type { GpxPoint, RouteData } from '../types'

/**
 * Calcul de distance orthodromique (Haversine) entre deux coordonnées géodésiques.
 * Renvoie la distance en mètres.
 */
export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Rayon moyen de la Terre en mètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calcule le cap (azimut / bearing) d'un point 1 vers un point 2.
 * Renvoie un angle en degrés [0, 360[ où 0° = Nord, 90° = Est.
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  const theta = Math.atan2(y, x)
  const bearing = ((theta * 180) / Math.PI + 360) % 360
  return bearing
}

/**
 * Parse un fichier GPX en mémoire via le DOMParser natif.
 * Aucun framework, aucune dépendance externe.
 */
export function parseGpxString(gpxText: string): RouteData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxText, 'application/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Le fichier GPX fourni est invalide ou corrompu.')
  }

  // Nom de la trace
  const nameEl = doc.querySelector('trk > name') || doc.querySelector('metadata > name')
  const routeName = nameEl?.textContent?.trim() || 'Sortie vélo'

  // Récupération des points de trace (<trkpt>) ou points de route (<rtept>)
  let ptElements = Array.from(doc.querySelectorAll('trkpt'))
  if (ptElements.length === 0) {
    ptElements = Array.from(doc.querySelectorAll('rtept'))
  }

  if (ptElements.length < 2) {
    throw new Error('La trace GPX doit contenir au moins 2 points GPS.')
  }

  // Extraction brute
  const rawPoints = ptElements.map((el) => {
    const lat = parseFloat(el.getAttribute('lat') || '0')
    const lon = parseFloat(el.getAttribute('lon') || '0')
    const eleEl = el.querySelector('ele')
    const ele = eleEl ? parseFloat(eleEl.textContent || '0') : 0
    return { lat, lon, ele }
  })

  // ponytail: lissage 3-points pour éliminer les micro-sauts d'altitude des GPS barométriques.
  // Plafond connu : atténue légèrement les bosses de 2 mètres, upgrade possible vers filtre Savitzky-Golay.
  const smoothedEle: number[] = rawPoints.map((pt, i) => {
    if (i === 0 || i === rawPoints.length - 1) return pt.ele
    return (rawPoints[i - 1].ele + pt.ele + rawPoints[i + 1].ele) / 3
  })

  const points: GpxPoint[] = []
  let cumulativeDistM = 0
  let elevationGainM = 0
  let elevationLossM = 0
  let minElevationM = smoothedEle[0] || 0
  let maxElevationM = smoothedEle[0] || 0

  for (let i = 0; i < rawPoints.length; i++) {
    const current = rawPoints[i]
    const ele = smoothedEle[i]

    if (ele < minElevationM) minElevationM = ele
    if (ele > maxElevationM) maxElevationM = ele

    let localSlope = 0

    if (i > 0) {
      const prev = rawPoints[i - 1]
      const prevEle = smoothedEle[i - 1]
      const segmentDistM = haversineDistanceM(prev.lat, prev.lon, current.lat, current.lon)
      cumulativeDistM += segmentDistM

      const deltaEle = ele - prevEle
      if (deltaEle > 0) {
        elevationGainM += deltaEle
      } else {
        elevationLossM += Math.abs(deltaEle)
      }

      // Pente locale (évite division par 0)
      if (segmentDistM > 1) {
        localSlope = deltaEle / segmentDistM
      }
    }

    points.push({
      lat: current.lat,
      lon: current.lon,
      ele: Math.round(ele),
      dist: cumulativeDistM / 1000,
      slope: localSlope,
    })
  }

  return {
    name: routeName,
    points,
    totalDistanceKm: cumulativeDistM / 1000,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minElevationM: Math.round(minElevationM),
    maxElevationM: Math.round(maxElevationM),
  }
}
