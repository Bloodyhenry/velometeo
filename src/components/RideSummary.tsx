import React from 'react'
import {
  Route as RouteIcon,
  TrendingUp,
  Clock,
  Wind,
  CloudRain,
  Thermometer,
  Flag,
} from 'lucide-react'
import type { Checkpoint, RouteData, SegmentWeatherSummary } from '../types'

interface RideSummaryProps {
  route: RouteData
  checkpoints: Checkpoint[]
  weatherSummary: SegmentWeatherSummary
  departureDate: Date
  arrivalDate: Date
}

export const RideSummary: React.FC<RideSummaryProps> = ({
  route,
  weatherSummary,
  departureDate,
  arrivalDate,
}) => {
  const durationMs = arrivalDate.getTime() - departureDate.getTime()
  const totalMinutes = Math.round(durationMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{route.name}</h1>
          <p className="text-xs text-slate-500">
            Départ prévu à {formatTime(departureDate)} • Arrivée estimée à {formatTime(arrivalDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {weatherSummary.dominantWindLabel}
          </span>
        </div>
      </div>

      {/* Cartes métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Distance */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <RouteIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Distance</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {route.totalDistanceKm.toFixed(1)} <span className="text-xs font-normal">km</span>
          </div>
        </div>

        {/* D+ */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            <span>Dénivelé +</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            +{route.elevationGainM} <span className="text-xs font-normal">m</span>
          </div>
        </div>

        {/* Durée estimée */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Durée</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {hours}h{mins < 10 ? `0${mins}` : mins}
          </div>
        </div>

        {/* Vent & Rafales */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Wind className="w-3.5 h-3.5 text-cyan-500" />
            <span>Vent moy.</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {weatherSummary.avgWindSpeedKmH}{' '}
            <span className="text-xs font-normal">km/h</span>
          </div>
          <p className="text-[10px] text-slate-400">Rafales max : {weatherSummary.maxGustKmH} km/h</p>
        </div>

        {/* Températures */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Thermometer className="w-3.5 h-3.5 text-rose-500" />
            <span>Températures</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {weatherSummary.minTempC}° / {weatherSummary.maxTempC}°
          </div>
          <p className="text-[10px] text-slate-400">Min / Max en route</p>
        </div>

        {/* Risque de pluie */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
            <span>Risque pluie</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {weatherSummary.maxPrecipitationProb} <span className="text-xs font-normal">%</span>
          </div>
          <p className="text-[10px] text-slate-400">
            {weatherSummary.maxPrecipitationProb > 40 ? 'Prévoyez le k-way 🌧️' : 'Temps sec attendu ✨'}
          </p>
        </div>
      </div>

      {/* Jauge d'impact du vent */}
      <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <Flag className="w-3.5 h-3.5 text-slate-500" /> Répartition du vent sur le trajet :
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-rose-600 font-semibold">Face : {weatherSummary.headwindPercent}%</span>
            <span className="text-amber-600 font-semibold">Travers : {weatherSummary.crosswindPercent}%</span>
            <span className="text-emerald-600 font-semibold">Dos : {weatherSummary.tailwindPercent}%</span>
          </div>
        </div>

        {/* Barre de répartition */}
        <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${weatherSummary.headwindPercent}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Vent de face : ${weatherSummary.headwindPercent}%`}
          />
          <div
            style={{ width: `${weatherSummary.crosswindPercent}%` }}
            className="bg-amber-400 transition-all duration-500"
            title={`Vent de travers : ${weatherSummary.crosswindPercent}%`}
          />
          <div
            style={{ width: `${weatherSummary.tailwindPercent}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Vent de dos : ${weatherSummary.tailwindPercent}%`}
          />
        </div>
      </div>
    </div>
  )
}
