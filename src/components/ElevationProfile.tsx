import React, { useState, useRef } from 'react'
import type { Checkpoint, GpxPoint } from '../types'
import { getWmoWeatherDetails } from '../services/weather'

interface ElevationProfileProps {
  points: GpxPoint[]
  checkpoints: Checkpoint[]
  selectedCheckpointId?: string | null
  onSelectCheckpoint?: (id: string) => void
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  points,
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (points.length < 2) return null

  const width = 800
  const height = 180
  const padding = { top: 28, right: 20, bottom: 24, left: 45 }

  const totalDist = points[points.length - 1].dist
  const minEle = Math.min(...points.map((p) => p.ele))
  const maxEle = Math.max(...points.map((p) => p.ele))
  const eleSpan = Math.max(50, maxEle - minEle)

  // Coordonnées SVG
  const getX = (distKm: number) =>
    padding.left + (distKm / (totalDist || 1)) * (width - padding.left - padding.right)

  const getY = (eleM: number) =>
    height - padding.bottom - ((eleM - minEle) / eleSpan) * (height - padding.top - padding.bottom)

  // Tracé SVG de la courbe
  const pathData = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.dist).toFixed(1)} ${getY(p.ele).toFixed(1)}`)
    .join(' ')

  const areaData = `${pathData} L ${getX(totalDist).toFixed(1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`

  // Échelle d'altitude (3 repères horizontaux)
  const eleTicks = [
    minEle,
    Math.round(minEle + eleSpan / 2),
    maxEle,
  ]

  // Gestion du survol
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * width
    const ratio = Math.max(0, Math.min(1, (svgX - padding.left) / (width - padding.left - padding.right)))
    const targetDist = ratio * totalDist

    // Trouve le point le plus proche
    let closestIdx = 0
    let minDiff = Infinity
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].dist - targetDist)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = i
      }
    }
    setHoverIndex(closestIdx)
  }

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
        <span className="font-semibold text-slate-800">Profil altimétrique & balises météo</span>
        <span className="text-[11px] text-slate-400">
          Survolez la courbe pour explorer le relief
        </span>
      </div>

      <div ref={containerRef} className="relative w-full aspect-[800/180]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
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
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 6}
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
                  y2={height - padding.bottom}
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
                y1={padding.top}
                x2={getX(hoveredPoint.dist)}
                y2={height - padding.bottom}
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
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <text
            x={padding.left}
            y={height - 8}
            className="text-[10px] fill-slate-500 font-mono"
          >
            0 km
          </text>
          <text
            x={width - padding.right}
            y={height - 8}
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
            Distance : <strong>{hoveredPoint.dist.toFixed(1)} km</strong>
          </span>
          <span>
            Altitude : <strong>{hoveredPoint.ele} m</strong>
          </span>
          <span>
            Pente locale :{' '}
            <strong className={hoveredPoint.slope > 0 ? 'text-amber-600' : 'text-emerald-600'}>
              {(hoveredPoint.slope * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}
