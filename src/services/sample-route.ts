/**
 * Trace GPX de démonstration : Boucle cycliste en Chartreuse / Grésivaudan (Isère).
 * Comprend :
 * - Départ en plaine (Grenoble / Meylan, alt ~220m)
 * - Montée du Col de Porte (alt ~1326m)
 * - Descente vers Saint-Pierre-de-Chartreuse (alt ~850m)
 * - Col du Cucheron (alt ~1139m)
 * - Retour par les balcons de Belledonne
 * Total : ~65 km avec ~1600m D+.
 */

function generateSampleGpxXml(): string {
  // Points clés : [lat, lon, ele, nom]
  const waypoints = [
    { lat: 45.195, lon: 5.765, ele: 220 }, // Meylan (Départ)
    { lat: 45.215, lon: 5.758, ele: 320 }, // Corenc
    { lat: 45.242, lon: 5.748, ele: 580 }, // Le Sappey-en-Chartreuse
    { lat: 45.265, lon: 5.755, ele: 850 }, // Mont-Saint-Martin
    { lat: 45.289, lon: 5.766, ele: 1326 }, // Col de Porte (Sommet 1)
    { lat: 45.312, lon: 5.789, ele: 1100 }, // Descente
    { lat: 45.342, lon: 5.815, ele: 850 }, // St-Pierre-de-Chartreuse
    { lat: 45.385, lon: 5.845, ele: 1139 }, // Col du Cucheron (Sommet 2)
    { lat: 45.421, lon: 5.892, ele: 620 }, // St-Pierre-d'Entremont
    { lat: 45.395, lon: 5.925, ele: 420 }, // Descente vers Grésivaudan
    { lat: 45.345, lon: 5.912, ele: 260 }, // Le Touvet
    { lat: 45.295, lon: 5.865, ele: 240 }, // Crolles
    { lat: 45.245, lon: 5.815, ele: 230 }, // Montbonnot
    { lat: 45.195, lon: 5.765, ele: 220 }, // Retour Meylan
  ]

  // Interpolation fine pour produire une trace continue et fluide (~250 points)
  const allPoints: { lat: number; lon: number; ele: number }[] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]
    const steps = 18 // 18 subdivisions par segment

    for (let s = 0; s < steps; s++) {
      const t = s / steps
      allPoints.push({
        lat: p1.lat + (p2.lat - p1.lat) * t,
        lon: p1.lon + (p2.lon - p1.lon) * t,
        ele: Math.round(p1.ele + (p2.ele - p1.ele) * t),
      })
    }
  }
  // Dernier point
  allPoints.push(waypoints[waypoints.length - 1])

  const trkpts = allPoints
    .map(
      (pt) =>
        `    <trkpt lat="${pt.lat.toFixed(5)}" lon="${pt.lon.toFixed(5)}"><ele>${pt.ele}</ele></trkpt>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VeloMeteo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Boucle Démo - Col de Porte & Chartreuse (65 km)</name>
  </metadata>
  <trk>
    <name>Boucle Démo - Col de Porte & Chartreuse (65 km)</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

export const SAMPLE_GPX_CONTENT = generateSampleGpxXml()
