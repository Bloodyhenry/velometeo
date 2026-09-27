import React from 'react'
import {
  Clock,
  Navigation,
  Wind,
  Droplets,
  Thermometer,
} from 'lucide-react'
import type { Checkpoint } from '../types'
import { getWmoWeatherDetails } from '../services/weather'
import { useI18n, getWindCategoryLabel } from '../services/i18n'

interface WeatherTimelineProps {
  checkpoints: Checkpoint[]
  selectedCheckpointId?: string | null
  onSelectCheckpoint?: (id: string) => void
}

export const WeatherTimeline: React.FC<WeatherTimelineProps> = ({
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint,
}) => {
  const { t, lang } = useI18n()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <span>{t('timelineTitle')}</span>
        </h2>
        <span className="text-xs text-slate-400">
          {t('timelineSubtitle', { count: checkpoints.length })}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {checkpoints.map((cp, idx) => {
          const isSelected = cp.id === selectedCheckpointId
          const w = cp.weather
          const wmo = w ? getWmoWeatherDetails(w.weatherCode, lang) : null
          const localizedWindLabel = w ? getWindCategoryLabel(w.windCategory, lang) : ''
          const timeStr = cp.estimatedTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })

          const isStart = idx === 0
          const isEnd = idx === checkpoints.length - 1

          return (
            <div
              key={cp.id}
              onClick={() => onSelectCheckpoint?.(cp.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-300 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Header card : Heure, Distance, Type */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-900 text-sm">{timeStr}</span>
                  <span className="text-xs text-slate-500">
                    ({cp.distKm} km • {cp.elevationM} m)
                  </span>
                </div>

                {isStart ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {t('startPoint')}
                  </span>
                ) : isEnd ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                    {t('finishPoint')}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">
                    {t('checkpointNum', { idx: idx + 1 })}
                  </span>
                )}
              </div>

              {w ? (
                <div className="space-y-2 text-xs">
                  {/* Ligne météo & température */}
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{wmo?.icon || '⛅'}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{wmo?.label}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-rose-500 inline" />
                          <span>{w.temperature}°C</span>
                          <span className="text-slate-400">({t('feelsLike')} {w.apparentTemperature}°C)</span>
                        </div>
                      </div>
                    </div>

                    {/* Pluie */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-indigo-600 font-semibold justify-end">
                        <Droplets className="w-3 h-3" />
                        <span>{w.precipitationProb}%</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{w.precipitationMm} mm</div>
                    </div>
                  </div>

                  {/* Ligne vent orientée vélo */}
                  <div className="p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        style={{ backgroundColor: w.windCategoryColor }}
                        className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs"
                      >
                        <div style={{ transform: `rotate(${w.windDirection + 180}deg)` }}>
                          ➔
                        </div>
                      </div>
                      <div>
                        <div
                          className="font-bold text-xs"
                          style={{ color: w.windCategoryColor }}
                        >
                          {localizedWindLabel}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5" />
                          <span>{t('riderBearing', { bearing: Math.round(cp.bearing), wind: w.windDirection })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-800 flex items-center gap-1 justify-end">
                        <Wind className="w-3 h-3 text-cyan-600" />
                        <span>{w.windSpeed} km/h</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t('gustsUpTo', { val: w.windGusts })}
                      </div>
                    </div>
                  </div>

                  {/* Composantes techniques vélo */}
                  <div className="flex justify-between text-[10px] text-slate-400 px-1 pt-0.5">
                    <span>
                      {w.headwindComponent > 0
                        ? t('headwindResistance', { val: w.headwindComponent })
                        : t('tailwindBoost', { val: Math.abs(w.headwindComponent) })}
                    </span>
                    <span>{t('lateralWind', { val: w.crosswindComponent })}</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  {t('loadingWeather')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
