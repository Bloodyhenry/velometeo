export interface GpxPoint {
  lat: number
  lon: number
  ele: number
  dist: number // Distance cumulée en km depuis le départ
  slope: number // Pente locale lissée (décimale, ex: 0.05 = 5%)
}

export type WindCategory =
  | 'headwind' // Vent de face (0-45°)
  | 'cross_headwind' // 3/4 face (45-75°)
  | 'crosswind' // Vent de côté (75-105°)
  | 'cross_tailwind' // 3/4 dos (105-135°)
  | 'tailwind' // Vent dans le dos (135-180°)

export interface WeatherPoint {
  temperature: number // °C
  apparentTemperature: number // °C
  precipitationProb: number // %
  precipitationMm: number // mm
  weatherCode: number // Code WMO
  windSpeed: number // km/h
  windGusts: number // km/h
  windDirection: number // Degrés (direction d'où vient le vent, 0° = Nord)
  relativeWindAngle: number // Angle relatif au cap du cycliste (0° = plein face, 180° = plein dos)
  windCategory: WindCategory
  windCategoryLabel: string
  windCategoryColor: string
  headwindComponent: number // km/h (> 0 freine, < 0 pousse)
  crosswindComponent: number // km/h
}

export interface Checkpoint {
  id: string
  pointIndex: number
  lat: number
  lon: number
  distKm: number
  elevationM: number
  bearing: number // Cap moyen du cycliste à cet endroit (0-360°)
  estimatedTime: Date
  weather?: WeatherPoint
  isSummit?: boolean
}

export interface RouteData {
  name: string
  points: GpxPoint[]
  totalDistanceKm: number
  elevationGainM: number // D+
  elevationLossM: number // D-
  minElevationM: number
  maxElevationM: number
}

export interface RideSettings {
  departureTime: string // ISO string "YYYY-MM-DDTHH:mm"
  targetSpeedKmH: number // Vitesse moyenne globale souhaitée (ex: 25 km/h)
  elevationWeight: number // 0 (plat) à 1 (physique réelle complète)
  checkpointIntervalKm: number // Distance entre les points météo (ex: 10 km)
}

export interface SegmentWeatherSummary {
  headwindPercent: number
  crosswindPercent: number
  tailwindPercent: number
  avgWindSpeedKmH: number
  maxGustKmH: number
  minTempC: number
  maxTempC: number
  maxPrecipitationProb: number
  dominantWindLabel: string
}
