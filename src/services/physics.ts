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
  // Assure que l'intervalle est un nombre valide >= 2 km
  const intervalKm = Math.max(2, Number(settings.checkpointIntervalKm) || 10)

  const chosenIndices = new Set<number>()
  chosenIndices.add(0) // Départ

  let nextTargetKm = intervalKm
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].dist >= nextTargetKm) {
      chosenIndices.add(i)
      while (nextTargetKm <= points[i].dist) {
        nextTargetKm += intervalKm
      }
    }
  }

  // Détection des sommets / cols locaux notables
  // Uniquement s'ils ne sont pas déjà proches d'un point existant (distance >= 40% de l'intervalle)
  for (let i = 15; i < points.length - 15; i += 10) {
    const p = points[i]
    const pBefore = points[i - 15]
    const pAfter = points[i + 15]
    if (p.ele > pBefore.ele + 60 && p.ele > pAfter.ele + 60) {
      const isTooClose = Array.from(chosenIndices).some(
        (idx) => Math.abs(points[idx].dist - p.dist) < intervalKm * 0.4
      )
      if (!isTooClose) {
        chosenIndices.add(i)
      }
    }
  }

  chosenIndices.add(points.length - 1) // Arrivée

  const sortedIndices = Array.from(chosenIndices).sort((a, b) => a - b)

  // Construction des Checkpoints avec calcul du cap moyen
  return sortedIndices.map((idx, step) => {
    const pt = points[idx]
    const timeHours = timing[idx]?.cumulativeTimeHours || 0
    const estimatedTime = new Date(departureDate.getTime() + timeHours * 3600 * 1000)

    // ponytail: Calcul du cap moyen sur les ~300 mètres suivants (ou précédents pour l'arrivée)
    let bearing: number
    if (idx < points.length - 1) {
      let lookAheadIdx = idx + 1
      while (lookAheadIdx < points.length - 1 && (points[lookAheadIdx].dist - pt.dist) < 0.3) {
        lookAheadIdx++
      }
      const ptTarget = points[lookAheadIdx]
      bearing = calculateBearing(pt.lat, pt.lon, ptTarget.lat, ptTarget.lon)
    } else {
      let lookBackIdx = idx - 1
      while (lookBackIdx > 0 && (pt.dist - points[lookBackIdx].dist) < 0.3) {
        lookBackIdx--
      }
      const ptFrom = points[lookBackIdx]
      bearing = calculateBearing(ptFrom.lat, ptFrom.lon, pt.lat, pt.lon)
    }

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

/**
 * Calcule les positions écran dé-collisionnées pour éviter la superposition des balises,
 * particulièrement sur les parcours en aller/retour (sur une même route) ou les lacets serrés.
 *
 * 1. Décalage latéral perpendiculaire au cap du cycliste (règle de droite).
 *    Sur un aller/retour, l'aller part à droite (+nx), le retour part à droite de son cap (-nx),
 *    ce qui les écarte naturellement de part et d'autre de la trace.
 * 2. Passe de dé-collision en espace écran pour garantir un espacement suffisant et une lisibilité parfaite.
 */
export function computeDeCollidedPositions(
  markers: Array<{ x: number; y: number; bearing?: number }>,
  options: {
    lateralOffset?: number
    pillWidth?: number
    pillHeight?: number
  } = {}
): Array<{ x: number; y: number }> {
  const lateralOffset = options.lateralOffset ?? 18
  const pillWidth = options.pillWidth ?? 95
  const pillHeight = options.pillHeight ?? 26

  // 1. Décalage latéral basé sur le cap (vecteur normal vers la droite)
  const positions = markers.map((m) => {
    const rad = ((m.bearing || 0) * Math.PI) / 180
    // nx = cos(rad), ny = sin(rad)
    const nx = Math.cos(rad)
    const ny = Math.sin(rad)
    return {
      x: m.x + nx * lateralOffset,
      y: m.y + ny * lateralOffset,
    }
  })

  // 2. Dé-collision en 3 passes de relaxation
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].x - positions[i].x
        const dy = positions[j].y - positions[i].y

        if (Math.abs(dx) < pillWidth && Math.abs(dy) < pillHeight) {
          // Chevauchement détecté : on écarte verticalement en priorité (pilules larges)
          const overlapY = pillHeight - Math.abs(dy)
          const shiftY = Math.max(14, overlapY / 2 + 2)

          if (dy >= 0) {
            positions[i].y -= shiftY
            positions[j].y += shiftY
          } else {
            positions[i].y += shiftY
            positions[j].y -= shiftY
          }

          // Écartement horizontal d'appoint si quasi alignées en X
          if (Math.abs(dx) < 30) {
            const shiftX = 16
            if (dx >= 0) {
              positions[i].x -= shiftX
              positions[j].x += shiftX
            } else {
              positions[i].x += shiftX
              positions[j].x += shiftX
            }
          }
        }
      }
    }
  }

  return positions
}

