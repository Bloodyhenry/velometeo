import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Checkpoint, RouteData } from '../types'
import { getWmoWeatherDetails } from '../services/weather'
import { useI18n, getWindCategoryLabel } from '../services/i18n'

interface RouteMapProps {
  route: RouteData
  checkpoints: Checkpoint[]
  selectedCheckpointId?: string | null
  onSelectCheckpoint?: (id: string) => void
}

export const RouteMap: React.FC<RouteMapProps> = ({
  route,
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint,
}) => {
  const { t, lang } = useI18n()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const polylineLayerRef = useRef<L.Polyline | null>(null)

  // 1. Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([45.2, 5.8], 11)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // 2. Mise à jour du tracé et centrage
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || route.points.length === 0) return

    // Supprime l'ancien tracé s'il existe
    if (polylineLayerRef.current) {
      polylineLayerRef.current.remove()
    }

    const latLngs = route.points.map((p) => [p.lat, p.lon] as [number, number])
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
    }).addTo(map)

    polylineLayerRef.current = polyline
    map.fitBounds(polyline.getBounds(), { padding: [30, 30] })
  }, [route])

  // 3. Mise à jour des marqueurs météo aux checkpoints
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    checkpoints.forEach((cp) => {
      const isSelected = cp.id === selectedCheckpointId
      const w = cp.weather
      const wmo = w ? getWmoWeatherDetails(w.weatherCode, lang) : null
      const localizedWindLabel = w ? getWindCategoryLabel(w.windCategory, lang) : ''

      // Icône personnalisée avec flèche de vent orientée
      const color = w?.windCategoryColor || '#64748b'
      const windAngle = w ? w.windDirection : 0

      const html = `
        <div class="relative group cursor-pointer flex flex-col items-center">
          <div style="background-color: ${color};" class="w-8 h-8 rounded-full border-2 ${
            isSelected ? 'border-blue-600 scale-125 ring-4 ring-blue-300' : 'border-white'
          } shadow-md flex items-center justify-center text-white text-xs font-bold transition-transform">
            ${
              w
                ? `<div style="transform: rotate(${windAngle + 180}deg); display: inline-block;">➔</div>`
                : '•'
            }
          </div>
          ${
            w
              ? `<div class="mt-0.5 bg-slate-900/85 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  ${Math.round(w.temperature)}°C | ${w.windSpeed}k
                 </div>`
              : ''
          }
        </div>
      `

      // Décalage latéral perpendiculaire au cap pour séparer les balises aller / retour
      const rad = ((cp.bearing || 0) * Math.PI) / 180
      const nx = Math.cos(rad)
      const ny = Math.sin(rad)
      const LATERAL_OFFSET = 14
      const anchorX = 16 - Math.round(nx * LATERAL_OFFSET)
      const anchorY = 21 - Math.round(ny * LATERAL_OFFSET)

      const customIcon = L.divIcon({
        className: 'custom-weather-marker',
        html,
        iconSize: [32, 42],
        iconAnchor: [anchorX, anchorY],
      })

      const marker = L.marker([cp.lat, cp.lon], { icon: customIcon })

      const timeStr = cp.estimatedTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })

      const popupContent = `
        <div class="p-1 space-y-1 font-sans text-xs">
          <div class="font-bold text-slate-900 border-b pb-1 flex justify-between items-center">
            <span>${t('passingAt')} ${timeStr}</span>
            <span class="text-blue-600 font-semibold">${cp.distKm} km (${cp.elevationM} m)</span>
          </div>
          ${
            w
              ? `
            <div class="flex items-center gap-2 pt-1">
              <span class="text-xl">${wmo?.icon || '⛅'}</span>
              <div>
                <div class="font-semibold text-slate-800">${wmo?.label || 'Météo'}</div>
                <div class="text-[11px] text-slate-500">${w.temperature}°C (${t('feelsLike')} ${w.apparentTemperature}°C)</div>
              </div>
            </div>
            <div class="pt-1 border-t border-slate-100 space-y-0.5">
              <div class="flex items-center justify-between">
                <span class="font-medium" style="color: ${w.windCategoryColor};">
                  ${localizedWindLabel}
                </span>
                <span class="font-bold text-slate-700">${w.windSpeed} km/h (rafales ${w.windGusts})</span>
              </div>
              <div class="flex items-center justify-between text-slate-500 text-[11px]">
                <span>${t('precipitation')}</span>
                <span>${w.precipitationProb}% (${w.precipitationMm} mm)</span>
              </div>
            </div>
          `
              : `<div class="text-slate-500 py-1">${t('loadingWeather')}</div>`
          }
        </div>
      `

      marker.bindPopup(popupContent)
      marker.on('click', () => {
        onSelectCheckpoint?.(cp.id)
      })

      layer.addLayer(marker)
    })
  }, [checkpoints, selectedCheckpointId, onSelectCheckpoint, lang, t])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[420px]">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
        <span>{t('mapTitle')}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> {t('mapHead')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> {t('mapCross')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> {t('mapTail')}
          </span>
        </div>
      </div>
      <div ref={mapContainerRef} className="w-full flex-1 z-0" />
    </div>
  )
}
