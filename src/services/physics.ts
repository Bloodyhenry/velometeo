import type { Checkpoint, GpxPoint, RideSettings, RouteData } from '../types'
import { calculateBearing } from './gpx'

/**
 * Facteur d'ajustement empirique de la vitesse cycliste selon la pente.
 * @param slope Pente décimale (ex: +0.07 pour 7% de montée, -0.05 pour 5% de descente)
 */
export function getGradeSpeedFactor(slope: number): number {
  if (slope > 0) {
    // Montée : la vitesse diminue rapidement avec la gravité.
    // À 6% : 1 / (1 + 8*0.06) = 1 / 1.48 ≈ 0.67 (25 km/h devient 16.8 km/h)
    // À 10% : 1 / (1 + 8*0.10) = 1 / 1.8 ≈ 0.55 (25 km/h devient 13.8 km/h)
    // Plafond bas de sécurité : 15% de la vitesse de référence
    return Math.max(0.15, 1 / (1 + 8 * slope))
  } else if (slope < 0) {
    // Descente : accélération avec seuil de sécurité / freinage dans les virages
    // À -5% : 1 - 4 * (-0.05) = 1 + 0.20 = 1.20 (25 km/h devient 30 km/h)
    // Plafonné à 2.2x
    return Math.min(2.2, 1 - 4 * slope)
  }
  return 1.0
}

export interface SegmentCalculation {
  speedKmH: number
  durationHours: number
  cumulativeTimeHours: number
}

/**
 * Calcule la vitesse et le temps de passage à chaque point du tracé
 * en respectant la vitesse moyenne globale cible et l'impact du relief.
 */
export function computeTrajectoryTiming(
  points: GpxPoint[],
  settings: RideSettings
): SegmentCalculation[] {
  if (points.length === 0) return []

  const { targetSpeedKmH, elevationWeight } = settings
  const alpha = Math.max(0, Math.min(1, elevationWeight))

  // 1. Calcul des vitesses théoriques relatives par segment
  const rawDurations: number[] = [0] // Premier point à t=0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const segmentDistKm = curr.dist - prev.dist

    if (segmentDistKm <= 0) {
      rawDurations.push(0)
      continue
    }

    const gradeFactor = getGradeSpeedFactor(curr.slope)
    // Modulation par le curseur utilisateur (alpha = 0 => plat uniforme)
    const modulatedFactor = (1 - alpha) * 1.0 + alpha * gradeFactor

    // Vitesse brute non normalisée
    // ponytail: cap de vitesse minimale à 5 km/h et maximale à 65 km/h pour le réalisme cycliste
    const rawSpeed = Math.min(65, Math.max(5, targetSpeedKmH * modulatedFactor))
    const durationH = segmentDistKm / rawSpeed
    rawDurations.push(durationH)
  }

  // 2. Normalisation pour que la moyenne globale soit STRICTEMENT égale à targetSpeedKmH
  const totalDistKm = points[points.length - 1].dist
  const totalTargetHours = totalDistKm > 0 && targetSpeedKmH > 0 ? totalDistKm / targetSpeedKmH : 0
  const rawTotalHours = rawDurations.reduce((acc, d) => acc + d, 0)

  const scaleCoeff = rawTotalHours > 0 ? totalTargetHours / rawTotalHours : 1.0

  let cumulativeTimeHours = 0
  const results: SegmentCalculation[] = []

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      results.push({
        speedKmH: targetSpeedKmH,
        durationHours: 0,
        cumulativeTimeHours: 0,
      })
      continue
    }

    const segmentDistKm = points[i].dist - points[i - 1].dist
    const scaledDurationH = rawDurations[i] * scaleCoeff
    cumulativeTimeHours += scaledDurationH

    const speedKmH = scaledDurationH > 0 ? segmentDistKm / scaledDurationH : targetSpeedKmH

    results.push({
      speedKmH,
      durationHours: scaledDurationH,
      cumulativeTimeHours,
    })
  }

  return results
}

/**
 * Sélectionne les points de contrôle météo (Checkpoints) le long du parcours.
 * Inclut le départ, l'arrivée, des points réguliers (tous les X km) et les cols majeurs.
 */
export function generateCheckpoints(
  route: RouteData,
  settings: RideSettings,
  timing: SegmentCalculation[]
): Checkpoint[] {
  const { points } = route
  if (points.length < 2) return []

  const departureDate = new Date(settings.departureTime)
  const intervalKm = Math.max(3, settings.checkpointIntervalKm)

  const chosenIndices = new Set<number>()
  chosenIndices.add(0) // Départ

  let nextTargetKm = intervalKm
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].dist >= nextTargetKm) {
      chosenIndices.add(i)
      nextTargetKm += intervalKm
    }
  }

  // Détection des sommets / cols locaux notables (différence > 100m)
  // ponytail: scan glissant de 20 points pour repérer les sommets sans surcharger d'appels
  for (let i = 10; i < points.length - 10; i += 5) {
    const p = points[i]
    const pBefore = points[i - 10]
    const pAfter = points[i + 10]
    if (p.ele > pBefore.ele + 80 && p.ele > pAfter.ele + 80) {
      chosenIndices.add(i)
    }
  }

  chosenIndices.add(points.length - 1) // Arrivée

  const sortedIndices = Array.from(chosenIndices).sort((a, b) => a - b)

  // Construction des Checkpoints avec calcul du cap moyen
  return sortedIndices.map((idx, step) => {
    const pt = points[idx]
    const timeHours = timing[idx]?.cumulativeTimeHours || 0
    const estimatedTime = new Date(departureDate.getTime() + timeHours * 3600 * 1000)

    // Calcul du cap moyen sur les 300 mètres suivants (ou précédents si fin)
    let lookAheadIdx = Math.min(points.length - 1, idx + 5)
    if (lookAheadIdx === idx && idx > 0) {
      lookAheadIdx = idx
      idx = Math.max(0, idx - 5)
    }
    const ptTarget = points[lookAheadIdx]
    const bearing = calculateBearing(pt.lat, pt.lon, ptTarget.lat, ptTarget.lon)

    return {
      id: `cp-${step}-${Math.round(pt.dist)}`,
      pointIndex: idx,
      lat: pt.lat,
      lon: pt.lon,
      distKm: Math.round(pt.dist * 10) / 10,
      elevationM: pt.ele,
      bearing,
      estimatedTime,
    }
  })
}
