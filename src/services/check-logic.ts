import assert from 'node:assert'
import { calculateBearing, haversineDistanceM } from './gpx'
import { computeTrajectoryTiming, getGradeSpeedFactor } from './physics'
import { classifyRelativeWind } from './weather'
import { GpxPoint, RideSettings } from '../types'

console.log('--- Running Ponytail Logic Self-Check ---')

// 1. Check Haversine distance
const distParisLyon = haversineDistanceM(48.8566, 2.3522, 45.764, 4.8357)
// Distance à vol d'oiseau Paris-Lyon ~392 km (tolérance 1%)
assert(distParisLyon > 385000 && distParisLyon < 400000, `Distance Paris-Lyon erronée: ${distParisLyon}`)
console.log('✓ Haversine distance calculation OK')

// 2. Check Bearing
// Directement vers le Nord
const bearingNorth = calculateBearing(45.0, 5.0, 46.0, 5.0)
assert(Math.abs(bearingNorth - 0) < 1 || Math.abs(bearingNorth - 360) < 1, `Bearing North erroné: ${bearingNorth}`)
// Vers l'Est
const bearingEast = calculateBearing(45.0, 5.0, 45.0, 6.0)
assert(Math.abs(bearingEast - 90) < 2, `Bearing East erroné: ${bearingEast}`)
console.log('✓ Bearing calculation OK')

// 3. Check Grade Factor
const flatFactor = getGradeSpeedFactor(0)
assert.strictEqual(flatFactor, 1.0, 'Flat grade factor should be 1.0')

const climbFactor = getGradeSpeedFactor(0.08) // 8% montée
assert(climbFactor < 0.7, `Climb factor at 8% should be < 0.7, got ${climbFactor}`)

const descentFactor = getGradeSpeedFactor(-0.06) // 6% descente
assert(descentFactor > 1.1, `Descent factor at -6% should be > 1.1, got ${descentFactor}`)
console.log('✓ Grade physics factor OK')

// 4. Check Timing & Speed Normalization
const dummyPoints: GpxPoint[] = [
  { lat: 45.0, lon: 5.0, ele: 200, dist: 0, slope: 0 },
  { lat: 45.1, lon: 5.0, ele: 800, dist: 10, slope: 0.06 }, // 10 km de montée à 6%
  { lat: 45.2, lon: 5.0, ele: 200, dist: 20, slope: -0.06 }, // 10 km de descente à -6%
]

const settings: RideSettings = {
  departureTime: '2026-09-27T08:00',
  targetSpeedKmH: 25,
  elevationWeight: 1.0,
  checkpointIntervalKm: 10,
}

const timings = computeTrajectoryTiming(dummyPoints, settings)
assert.strictEqual(timings.length, 3)

// Vitesse en montée doit être inférieure à la vitesse en descente
const climbSpeed = timings[1].speedKmH
const descentSpeed = timings[2].speedKmH
assert(climbSpeed < descentSpeed, `Climb speed (${climbSpeed}) should be lower than descent speed (${descentSpeed})`)

// Durée totale pour 20 km à 25 km/h doit être EXACTEMENT 0.8 heures (48 minutes)
const totalHours = timings[2].cumulativeTimeHours
assert(Math.abs(totalHours - 20 / 25) < 0.001, `Total hours should match target average speed, got ${totalHours}`)
console.log('✓ Trajectory timing and target speed normalization OK')

// 5. Check Wind Angle Classification
// Cycliste va vers le Nord (0°), vent vient du Nord (0°) => Face
const headwind = classifyRelativeWind(0, 0)
assert.strictEqual(headwind.category, 'headwind')

// Cycliste va vers le Nord (0°), vent vient du Sud (180°) => Dos
const tailwind = classifyRelativeWind(180, 0)
assert.strictEqual(tailwind.category, 'tailwind')

// Cycliste va vers le Nord (0°), vent vient de l'Est (90°) => Côté
const crosswind = classifyRelativeWind(90, 0)
assert.strictEqual(crosswind.category, 'crosswind')

console.log('✓ Wind relative classification OK')

// 6. Check Komoot Coordinates -> GPX converter
import { coordinatesToGpx } from './page-detector'
const testCoords = [
  { lat: 45.1, lng: 5.7, alt: 220 },
  { lat: 45.2, lng: 5.8, alt: 850 },
]
const gpxOutput = coordinatesToGpx(testCoords, 'Col Test')
assert(gpxOutput.includes('<trkpt lat="45.100000" lon="5.700000"><ele>220</ele></trkpt>'), 'Missing point 1 in GPX')
assert(gpxOutput.includes('<trkpt lat="45.200000" lon="5.800000"><ele>850</ele></trkpt>'), 'Missing point 2 in GPX')
assert(gpxOutput.includes('<name>Col Test</name>'), 'Missing name in GPX')
console.log('✓ Komoot coordinates -> GPX converter OK')

console.log('All core logic checks passed successfully! 🎉')
