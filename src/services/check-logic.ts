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

// 7. Check Checkpoint Interval Scaling
import { generateCheckpoints } from './physics'
import type { RouteData } from '../types'

const longRoutePoints: GpxPoint[] = []
for (let d = 0; d <= 60; d += 0.5) {
  longRoutePoints.push({
    lat: 45.0 + d * 0.01,
    lon: 5.0,
    ele: 200,
    dist: d,
    slope: 0,
  })
}
const testRoute: RouteData = {
  name: 'Test 60km',
  points: longRoutePoints,
  totalDistanceKm: 60,
  elevationGainM: 0,
  elevationLossM: 0,
  minElevationM: 200,
  maxElevationM: 200,
}
const longTimings = computeTrajectoryTiming(longRoutePoints, settings)
const cps5km = generateCheckpoints(testRoute, { ...settings, checkpointIntervalKm: 5 }, longTimings)
const cps10km = generateCheckpoints(testRoute, { ...settings, checkpointIntervalKm: 10 }, longTimings)
const cps20km = generateCheckpoints(testRoute, { ...settings, checkpointIntervalKm: 20 }, longTimings)

assert(cps5km.length > cps10km.length, `5km checkpoints (${cps5km.length}) should be > 10km (${cps10km.length})`)
assert(cps10km.length > cps20km.length, `10km checkpoints (${cps10km.length}) should be > 20km (${cps20km.length})`)
console.log(`✓ Checkpoint interval scaling OK (5km: ${cps5km.length}, 10km: ${cps10km.length}, 20km: ${cps20km.length})`)

// 8. Check De-collision on Out-and-back (Aller / Retour) traces
import { computeDeCollidedPositions } from './physics'

// Cas 1 : Aller / retour sur route Nord-Sud (même point (200, 200), sens opposés 0° et 180°)
const northSouthOverlap = [
  { x: 200, y: 200, bearing: 0 },
  { x: 200, y: 200, bearing: 180 },
]
const resolvedNS = computeDeCollidedPositions(northSouthOverlap)
const distNS = Math.hypot(resolvedNS[0].x - resolvedNS[1].x, resolvedNS[0].y - resolvedNS[1].y)
assert(distNS >= 30, `Distance entre balises aller/retour NS insuffisante: ${distNS}px (doit être >= 30px)`)
assert(
  Math.abs(resolvedNS[0].x - resolvedNS[1].x) >= 20 || Math.abs(resolvedNS[0].y - resolvedNS[1].y) >= 25,
  'Les balises aller/retour NS se chevauchent encore en écran'
)

// Cas 2 : Aller / retour sur route Est-Ouest (même point (300, 300), sens opposés 90° et 270°)
const eastWestOverlap = [
  { x: 300, y: 300, bearing: 90 },
  { x: 300, y: 300, bearing: 270 },
]
const resolvedEW = computeDeCollidedPositions(eastWestOverlap)
const distEW = Math.hypot(resolvedEW[0].x - resolvedEW[1].x, resolvedEW[0].y - resolvedEW[1].y)
assert(distEW >= 30, `Distance entre balises aller/retour EW insuffisante: ${distEW}px (doit être >= 30px)`)
assert(
  Math.abs(resolvedEW[0].x - resolvedEW[1].x) >= 20 || Math.abs(resolvedEW[0].y - resolvedEW[1].y) >= 25,
  'Les balises aller/retour EW se chevauchent encore en écran'
)

console.log(`✓ Out-and-back (aller/retour) marker de-collision OK (dist NS: ${Math.round(distNS)}px, dist EW: ${Math.round(distEW)}px)`)

// 9. Check Strava URL Detection and Polyline Decoding
import { getStravaInfoFromUrl, decodePolyline } from './strava'

// Route detection with ID
const routeInfo = getStravaInfoFromUrl('/routes/30528612')
assert.deepStrictEqual(routeInfo, { id: '30528612', type: 'route' }, 'Strava route detection failed')

// Athlete route detection
const athleteRoute = getStravaInfoFromUrl('/athlete/routes/998877')
assert.deepStrictEqual(athleteRoute, { id: '998877', type: 'route' }, 'Strava athlete route detection failed')

// Maps route detection
const mapsRoute = getStravaInfoFromUrl('/maps/routes/554433')
assert.deepStrictEqual(mapsRoute, { id: '554433', type: 'route' }, 'Strava maps route detection failed')

// Route builder / Maps generic detection (/routes/, /routes, /maps)
const routeBuilder1 = getStravaInfoFromUrl('/routes/')
assert.deepStrictEqual(routeBuilder1, { id: 'builder', type: 'route' }, 'Strava /routes/ detection failed')

const routeBuilder2 = getStravaInfoFromUrl('/maps')
assert.deepStrictEqual(routeBuilder2, { id: 'builder', type: 'route' }, 'Strava /maps detection failed')

// Activity detection with ID
const activityInfo = getStravaInfoFromUrl('/activities/1234567890/overview')
assert.deepStrictEqual(activityInfo, { id: '1234567890', type: 'activity' }, 'Strava activity detection failed')

// Activity generic detection (/activities/, /activities)
const activityGeneric = getStravaInfoFromUrl('/activities/')
assert.deepStrictEqual(activityGeneric, { id: 'activity', type: 'activity' }, 'Strava /activities/ detection failed')

// Non-matching page
const nonStrava = getStravaInfoFromUrl('/dashboard')
assert.strictEqual(nonStrava, null, 'Non-route Strava page should return null')

// Polyline decoding check (official Google encoded polyline example: ~38.5, -120.2 to ~40.7, -120.95 to ~43.252, -126.453)
const testPolyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
const decoded = decodePolyline(testPolyline)
assert.strictEqual(decoded.length, 3, 'Decoded polyline length should be 3')
assert(Math.abs(decoded[0].lat - 38.5) < 0.001 && Math.abs(decoded[0].lng - -120.2) < 0.001, 'Point 1 mismatch')
assert(Math.abs(decoded[1].lat - 40.7) < 0.001 && Math.abs(decoded[1].lng - -120.95) < 0.001, 'Point 2 mismatch')
assert(Math.abs(decoded[2].lat - 43.252) < 0.001 && Math.abs(decoded[2].lng - -126.453) < 0.001, 'Point 3 mismatch')
console.log('✓ Strava URL parser (routes, activities, builder, maps) and polyline decoder OK')

console.log('All core logic checks passed successfully! 🎉')

