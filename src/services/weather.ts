import type { Checkpoint, SegmentWeatherSummary, WeatherPoint, WindCategory } from '../types'

/**
 * Catégorisation de l'angle du vent relatif au cap du vélo.
 */
export function classifyRelativeWind(
  windDirectionDeg: number,
  cyclistBearingDeg: number
): {
  relativeAngle: number
  category: WindCategory
  label: string
  color: string
} {
  // Différence d'angle [0, 180]
  let diff = Math.abs(windDirectionDeg - cyclistBearingDeg) % 360
  if (diff > 180) {
    diff = 360 - diff
  }

  // 0° = le vent vient exactement d'en face
  // 180° = le vent vient exactement de derrière
  if (diff <= 45) {
    return {
      relativeAngle: Math.round(diff),
      category: 'headwind',
      label: 'Vent de face',
      color: '#ef4444', // Rouge
    }
  } else if (diff <= 75) {
    return {
      relativeAngle: Math.round(diff),
      category: 'cross_headwind',
      label: '3/4 face',
      color: '#f97316', // Orange
    }
  } else if (diff <= 105) {
    return {
      relativeAngle: Math.round(diff),
      category: 'crosswind',
      label: 'Vent de côté',
      color: '#eab308', // Jaune
    }
  } else if (diff <= 135) {
    return {
      relativeAngle: Math.round(diff),
      category: 'cross_tailwind',
      label: '3/4 dos',
      color: '#84cc16', // Vert clair
    }
  } else {
    return {
      relativeAngle: Math.round(diff),
      category: 'tailwind',
      label: 'Vent dans le dos',
      color: '#10b981', // Vert émeraude
    }
  }
}

interface OpenMeteoHourlyResponse {
  latitude: number
  longitude: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    apparent_temperature: number[]
    precipitation_probability: number[]
    precipitation: number[]
    weather_code: number[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
  }
}

/**
 * Interroge l'API Open-Meteo pour un ensemble de checkpoints en un seul appel groupé.
 * Gratuit, sans clé API, CORS ouvert.
 */
export async function fetchWeatherForCheckpoints(
  checkpoints: Checkpoint[]
): Promise<Checkpoint[]> {
  if (checkpoints.length === 0) return []

  const lats = checkpoints.map((cp) => cp.lat.toFixed(4)).join(',')
  const lons = checkpoints.map((cp) => cp.lon.toFixed(4)).join(',')

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timeformat=iso8601`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération météo : ${response.statusText}`)
  }

  const rawData = await response.json()
  // Si plusieurs points, Open-Meteo retourne un tableau d'objets ; sinon un seul objet
  const results: OpenMeteoHourlyResponse[] = Array.isArray(rawData) ? rawData : [rawData]

  return checkpoints.map((cp, idx) => {
    const pointData = results[idx]
    if (!pointData || !pointData.hourly) {
      return cp
    }

    const h = pointData.hourly

    // Recherche de l'index horaire le plus proche
    let closestIndex = 0
    let minDiffMs = Infinity
    const targetMs = cp.estimatedTime.getTime()

    for (let i = 0; i < h.time.length; i++) {
      const timeMs = new Date(h.time[i] + 'Z').getTime()
      const diff = Math.abs(timeMs - targetMs)
      if (diff < minDiffMs) {
        minDiffMs = diff
        closestIndex = i
      }
    }

    const windSpeed = h.wind_speed_10m[closestIndex] ?? 0
    const windDirection = h.wind_direction_10m[closestIndex] ?? 0
    const windGusts = h.wind_gusts_10m[closestIndex] ?? windSpeed
    const temperature = h.temperature_2m[closestIndex] ?? 18
    const apparentTemperature = h.apparent_temperature[closestIndex] ?? temperature
    const precipitationProb = h.precipitation_probability[closestIndex] ?? 0
    const precipitationMm = h.precipitation[closestIndex] ?? 0
    const weatherCode = h.weather_code[closestIndex] ?? 0

    const { relativeAngle, category, label, color } = classifyRelativeWind(
      windDirection,
      cp.bearing
    )

    // Calcul des composantes trigo
    const angleRad = ((windDirection - cp.bearing) * Math.PI) / 180
    const headwindComponent = Math.round(windSpeed * Math.cos(angleRad) * 10) / 10
    const crosswindComponent = Math.round(windSpeed * Math.abs(Math.sin(angleRad)) * 10) / 10

    const weather: WeatherPoint = {
      temperature: Math.round(temperature * 10) / 10,
      apparentTemperature: Math.round(apparentTemperature * 10) / 10,
      precipitationProb: Math.round(precipitationProb),
      precipitationMm: Math.round(precipitationMm * 10) / 10,
      weatherCode,
      windSpeed: Math.round(windSpeed),
      windGusts: Math.round(windGusts),
      windDirection: Math.round(windDirection),
      relativeWindAngle: relativeAngle,
      windCategory: category,
      windCategoryLabel: label,
      windCategoryColor: color,
      headwindComponent,
      crosswindComponent,
    }

    return {
      ...cp,
      weather,
    }
  })
}

/**
 * Calcule les statistiques globales météo de la sortie.
 */
export function computeRideWeatherSummary(checkpoints: Checkpoint[]): SegmentWeatherSummary {
  const withWeather = checkpoints.filter((cp): cp is Checkpoint & { weather: WeatherPoint } =>
    Boolean(cp.weather)
  )

  if (withWeather.length === 0) {
    return {
      headwindPercent: 0,
      crosswindPercent: 0,
      tailwindPercent: 0,
      avgWindSpeedKmH: 0,
      maxGustKmH: 0,
      minTempC: 0,
      maxTempC: 0,
      maxPrecipitationProb: 0,
      dominantWindLabel: 'Données indisponibles',
    }
  }

  let headCount = 0
  let crossCount = 0
  let tailCount = 0
  let windSpeedSum = 0
  let maxGust = 0
  let minTemp = Infinity
  let maxTemp = -Infinity
  let maxRainProb = 0

  for (const cp of withWeather) {
    const w = cp.weather
    windSpeedSum += w.windSpeed
    if (w.windGusts > maxGust) maxGust = w.windGusts
    if (w.temperature < minTemp) minTemp = w.temperature
    if (w.temperature > maxTemp) maxTemp = w.temperature
    if (w.precipitationProb > maxRainProb) maxRainProb = w.precipitationProb

    if (w.windCategory === 'headwind' || w.windCategory === 'cross_headwind') {
      headCount++
    } else if (w.windCategory === 'crosswind') {
      crossCount++
    } else {
      tailCount++
    }
  }

  const total = withWeather.length
  const headPct = Math.round((headCount / total) * 100)
  const crossPct = Math.round((crossCount / total) * 100)
  const tailPct = Math.round((tailCount / total) * 100)

  let dominantWindLabel = 'Variable'
  if (headPct >= 50) dominantWindLabel = 'Principalement de face 🔴'
  else if (tailPct >= 50) dominantWindLabel = 'Principalement dans le dos 🚀'
  else if (crossPct >= 40) dominantWindLabel = 'Principalement de travers 🟡'

  return {
    headwindPercent: headPct,
    crosswindPercent: crossPct,
    tailwindPercent: tailPct,
    avgWindSpeedKmH: Math.round(windSpeedSum / total),
    maxGustKmH: Math.round(maxGust),
    minTempC: Math.round(minTemp * 10) / 10,
    maxTempC: Math.round(maxTemp * 10) / 10,
    maxPrecipitationProb: maxRainProb,
    dominantWindLabel,
  }
}

/**
 * Traduit le code météo WMO officiel en libellé français et icône.
 */
export function getWmoWeatherDetails(code: number): { label: string; icon: string } {
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
