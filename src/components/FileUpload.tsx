import React, { useRef, useState } from 'react'
import { Upload, Bike } from 'lucide-react'
import { SAMPLE_GPX_CONTENT } from '../services/sample-route'
import { useI18n } from '../services/i18n'

interface FileUploadProps {
  onGpxLoaded: (gpxContent: string, fileName: string) => void
  isLoading?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onGpxLoaded,
  isLoading,
}) => {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      alert(t('selectGpxAlert'))
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
      <label
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
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

        <div className="flex flex-col items-center justify-center gap-1.5">
          <Upload className="w-6 h-6 text-slate-400" />
          <p className="text-xs font-medium text-slate-700">
            {t('dropzoneText')} <span className="text-blue-600 font-semibold">.GPX</span> {t('dropzoneTextAfter')}
          </p>
        </div>
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation()
            onGpxLoaded(SAMPLE_GPX_CONTENT, '')
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer"
        >
          <Bike className="w-3.5 h-3.5" />
          {t('loadDemoBtn')}
        </button>
      </div>
    </div>
  )
}
