import React, { useRef, useState } from 'react'
import {
  Upload,
  Bike,
  FileCode,
  CheckCircle2,
  Download,
  RefreshCw,
  AlertCircle,
  MapPin,
} from 'lucide-react'
import { SAMPLE_GPX_CONTENT } from '../services/sample-route'
import type { DetectedTabInfo } from '../services/page-detector'

interface FileUploadProps {
  onGpxLoaded: (gpxContent: string, fileName: string) => void
  currentFileName?: string
  isLoading?: boolean
  detectedTab?: DetectedTabInfo | null
  onImportTab?: () => void
  isImportingTab?: boolean
  importError?: string | null
  onRescanTab?: () => void
  onInjectOnKomootMap?: () => void
  isInjectingMap?: boolean
  injectionMessage?: string | null
  canInjectMap?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onGpxLoaded,
  currentFileName,
  isLoading,
  detectedTab,
  onImportTab,
  isImportingTab,
  importError,
  onRescanTab,
  onInjectOnKomootMap,
  isInjectingMap,
  injectionMessage,
  canInjectMap,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      alert('Veuillez sélectionner un fichier au format .gpx')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        onGpxLoaded(text, file.name)
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      {/* 1. Détection automatique Komoot / Onglet actif */}
      {detectedTab && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-400 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                K
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
                    Parcours Komoot détecté
                  </span>
                  {detectedTab.tourId ? (
                    <span className="text-xs font-semibold text-emerald-700">
                      Tour #{detectedTab.tourId}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 font-medium">
                      Ouvrez un tour spécifique sur la page Komoot
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                  {detectedTab.title}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isImportingTab}
                onClick={onImportTab}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Download className={`w-4 h-4 ${isImportingTab ? 'animate-bounce' : ''}`} />
                {isImportingTab ? 'Importation...' : 'Importer'}
              </button>

              {canInjectMap && onInjectOnKomootMap && (
                <button
                  type="button"
                  disabled={isInjectingMap}
                  onClick={onInjectOnKomootMap}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {isInjectingMap ? 'Projection...' : 'Afficher sur la carte Komoot'}
                </button>
              )}

              {onRescanTab && (
                <button
                  type="button"
                  onClick={onRescanTab}
                  title="Rescanner l'onglet actif"
                  className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {injectionMessage && (
            <div className="mt-3 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{injectionMessage}</span>
            </div>
          )}

          {importError && (
            <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{importError}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. Zone de Drag & Drop standard */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0])
            }
          }}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {currentFileName ? (
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <CheckCircle2 className="w-6 h-6" />
              <span>
                Trace active : <strong>{currentFileName}</strong>
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                Glissez-déposez votre fichier <span className="text-blue-600 font-semibold">.GPX</span> ici, ou cliquez pour parcourir
              </p>
              <p className="text-xs text-slate-500">
                Compatible Strava, Garmin, Komoot, OpenRunner, etc.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pied de zone (bouton démo et info) */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <FileCode className="w-3.5 h-3.5" /> Traitement 100% local dans votre navigateur
        </span>

        <button
          type="button"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation()
            onGpxLoaded(SAMPLE_GPX_CONTENT, 'Boucle Démo - Col de Porte (65 km)')
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer"
        >
          <Bike className="w-3.5 h-3.5" />
          Charger la trace de démo (Alps / Chartreuse)
        </button>
      </div>
    </div>
  )
}
