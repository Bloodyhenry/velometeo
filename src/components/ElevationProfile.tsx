import React, { useState, useRef } from 'react'
import type { Checkpoint, GpxPoint } from '../types'
import { getWmoWeatherDetails } from '../services/weather'
import { useI18n } from '../services/i18n'

interface ElevationProfileProps {
  points: GpxPoint[]
  checkpoints: Checkpoint[]
  selectedCheckpointId?: string | null
  onSelectCheckpoint?: (id: string) => void
}

const CHART_WIDTH = 800
const CHART_HEIGHT = 180
const CHART_PADDING = { top: 28, right: 20, bottom: 24, left: 45 }

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  points,
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint,
}) => {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // ponytail: Mémorisation complète des données géométriques SVG pour éviter de recalculer à chaque frame de survol
  const chartData = React.useMemo(() => {
    if (points.length < 2) return null
    const totalDist = points[points.length - 1].dist
    let minEle = points[0].ele
    let maxEle = points[0].ele
    for (let i = 1; i < points.length; i++) {
      if (points[i].ele < minEle) minEle = points[i].ele
      if (points[i].ele > maxEle) maxEle = points[i].ele
    }
    const eleSpan = Math.max(50, maxEle - minEle)

    const getX = (distKm: number) =>
      CHART_PADDING.left +
      (distKm / (totalDist || 1)) * (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)

    const getY = (eleM: number) =>
      CHART_HEIGHT -
      CHART_PADDING.bottom -
      ((eleM - minEle) / eleSpan) * (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)

    const pathData = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.dist).toFixed(1)} ${getY(p.ele).toFixed(1)}`)
      .join(' ')

    const areaData = `${pathData} L ${getX(totalDist).toFixed(1)} ${CHART_HEIGHT - CHART_PADDING.bottom} L ${CHART_PADDING.left} ${CHART_HEIGHT - CHART_PADDING.bottom} Z`

    const eleTicks = [minEle, Math.round(minEle + eleSpan / 2), maxEle]

    return { totalDist, getX, getY, pathData, areaData, eleTicks }
  }, [points])

  if (!chartData || points.length < 2) return null
  const { totalDist, getX, getY, pathData, areaData, eleTicks } = chartData

  // ponytail: Recherche binaire O(log N) sur les distances ordonnées pour un survol fluide
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * CHART_WIDTH
    const ratio = Math.max(
      0,
      Math.min(1, (svgX - CHART_PADDING.left) / (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right))
    )
    const targetDist = ratio * totalDist

    let low = 0
    let high = points.length - 1
    while (low < high) {
      const mid = (low + high) >> 1
      if (points[mid].dist < targetDist) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    const closestIdx =
      low > 0 && Math.abs(points[low - 1].dist - targetDist) < Math.abs(points[low].dist - targetDist)
        ? low - 1
        : low
    setHoverIndex(closestIdx)
  }

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
        <span className="font-semibold text-slate-800">{t('profileTitle')}</span>
        <span className="text-[11px] text-slate-400">
          {t('profileSubtitle')}
        </span>
      </div>

      <div ref={containerRef} className="relative w-full aspect-[800/180]">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={t('profileTitle')}
          className="w-full h-full overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="eleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Lignes d'échelle d'altitude horizontales */}
          {eleTicks.map((tick) => {
            const y = getY(tick)
            return (
              <g key={tick}>
                <line
                  x1={CHART_PADDING.left}
                  y1={y}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={CHART_PADDING.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {tick}m
                </text>
              </g>
            )
          })}

          {/* Remplissage sous la courbe */}
          <path d={areaData} fill="url(#eleGradient)" />

          {/* Ligne de dénivelé */}
          <path
            d={pathData}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Marqueurs des Checkpoints météo le long de la courbe */}
          {checkpoints.map((cp) => {
            const cx = getX(cp.distKm)
            const cy = getY(cp.elevationM)
            const isSelected = cp.id === selectedCheckpointId
            const w = cp.weather
            const wmo = w ? getWmoWeatherDetails(w.weatherCode) : null
            const color = w?.windCategoryColor || '#3b82f6'

            return (
              <g
                key={cp.id}
                className="cursor-pointer group"
                onClick={() => onSelectCheckpoint?.(cp.id)}
              >
                {/* Ligne verticale repère */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={CHART_HEIGHT - CHART_PADDING.bottom}
                  stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                  strokeWidth={isSelected ? '2' : '1'}
                  strokeDasharray={isSelected ? 'none' : '2 2'}
                />

                {/* Bulle météo au-dessus du point */}
                {w && (
                  <g transform={`translate(${cx}, ${Math.max(12, cy - 14)})`}>
                    <rect
                      x="-18"
                      y="-12"
                      width="36"
                      height="14"
                      rx="3"
                      fill="#0f172a"
                      opacity="0.85"
                    />
                    <text
                      x="0"
                      y="-2"
                      textAnchor="middle"
                      className="text-[8px] fill-white font-bold"
                    >
                      {Math.round(w.temperature)}° {wmo?.icon || ''}
                    </text>
                  </g>
                )}

                {/* Point d'ancrage */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 6 : 4}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all"
                />
              </g>
            )
          })}

          {/* Ligne et info-bulle de survol */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.dist)}
                y1={CHART_PADDING.top}
                x2={getX(hoveredPoint.dist)}
                y2={CHART_HEIGHT - CHART_PADDING.bottom}
                stroke="#0f172a"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoveredPoint.dist)}
                cy={getY(hoveredPoint.ele)}
                r="5"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Axe X (km) */}
          <line
            x1={CHART_PADDING.left}
            y1={CHART_HEIGHT - CHART_PADDING.bottom}
            x2={CHART_WIDTH - CHART_PADDING.right}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <text
            x={CHART_PADDING.left}
            y={CHART_HEIGHT - 8}
            className="text-[10px] fill-slate-500 font-mono"
          >
            0 km
          </text>
          <text
            x={CHART_WIDTH - CHART_PADDING.right}
            y={CHART_HEIGHT - 8}
            textAnchor="end"
            className="text-[10px] fill-slate-500 font-mono"
          >
            {totalDist.toFixed(1)} km
          </text>
        </svg>
      </div>

      {/* Info-bulle dynamique lors du survol */}
      {hoveredPoint && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200">
          <span>
            {t('distance')} : <strong>{hoveredPoint.dist.toFixed(1)} km</strong>
          </span>
          <span>
            {t('elevation')} : <strong>{hoveredPoint.ele} m</strong>
          </span>
          <span>
            {t('grade')} :{' '}
            <strong className={hoveredPoint.slope > 0 ? 'text-amber-600' : 'text-emerald-600'}>
              {(hoveredPoint.slope * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}
