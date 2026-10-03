import React from 'react'
import { Calendar, Gauge, Mountain, MapPin, RefreshCw } from 'lucide-react'
import type { RideSettings } from '../types'
import { useI18n } from '../services/i18n'

interface ControlsProps {
  settings: RideSettings
  onChange: (newSettings: RideSettings) => void
  onRefresh: () => void
  isLoading?: boolean
}

export const Controls: React.FC<ControlsProps> = ({
  settings,
  onChange,
  onRefresh,
  isLoading,
}) => {
  const { t } = useI18n()

  const handleChange = <K extends keyof RideSettings>(key: K, value: RideSettings[K]) => {
    onChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center justify-between">
        <span>{t('rideSettings')}</span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? t('calculating') : t('calcWeather')}
        </button>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Date et Heure de départ */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-500" />
            {t('departureTime')}
          </label>
          <input
            type="datetime-local"
            value={settings.departureTime}
            onChange={(e) => {
              const val = e.target.value
              if (val && !Number.isNaN(Date.parse(val))) {
                handleChange('departureTime', val)
              }
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
          />
          <p className="text-[11px] text-slate-400">{t('hourlyForecast')}</p>
        </div>

        {/* 2. Vitesse moyenne globale */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-500" />
              {t('targetSpeed')}
            </label>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {settings.targetSpeedKmH} km/h
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={42}
            step={0.5}
            value={settings.targetSpeedKmH}
            onChange={(e) => handleChange('targetSpeedKmH', parseFloat(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>15 km/h</span>
            <span>25 km/h ({t('speedStandard')})</span>
            <span>42 km/h</span>
          </div>
        </div>

        {/* 3. Pondération dénivelé */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-amber-500" />
              {t('elevationWeight')}
            </label>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {Math.round(settings.elevationWeight * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.elevationWeight}
            onChange={(e) => handleChange('elevationWeight', parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0% ({t('flat')})</span>
            <span>70% ({t('realistic')})</span>
            <span>100% ({t('strict')})</span>
          </div>
        </div>

        {/* 4. Intervalle des checkpoints météo */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-purple-500" />
              {t('weatherSpacing')}
            </label>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              {t('everyXKm', { km: settings.checkpointIntervalKm })}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={25}
            step={2.5}
            value={settings.checkpointIntervalKm}
            onChange={(e) => handleChange('checkpointIntervalKm', parseFloat(e.target.value))}
            className="w-full accent-purple-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>5 km ({t('dense')})</span>
            <span>10 km</span>
            <span>25 km ({t('sparse')})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
