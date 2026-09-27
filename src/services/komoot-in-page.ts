/**
 * Script injecté directement dans la page Komoot (world: 'MAIN')
 * pour afficher les balises météo et la jauge de vent directement sur la carte MapLibre/Mapbox.
 */

import { computeDeCollidedPositions } from './physics'

export interface InjectedWeatherPayload {
  checkpoints: Array<{
    id: string
    lat: number
    lon: number
    bearing?: number
    distKm: number
    elevationM: number
    estimatedTimeStr: string
    temperature: number
    apparentTemperature: number
    windSpeed: number
    windGusts: number
    windDirection: number
    windCategory: string
    windCategoryLabel: string
    windCategoryColor: string
    weatherIcon: string
    weatherLabel: string
    precipitationProb: number
    precipitationMm: number
    headwindComponent: number
    crosswindComponent: number
  }>
  summary: {
    headwindPercent: number
    crosswindPercent: number
    tailwindPercent: number
    avgWindSpeedKmH: number
    maxGustKmH: number
    minTempC: number
    maxTempC: number
    maxPrecipitationProb: number
    dominantWindLabel: string
  }
  settings: {
    departureTime: string
    targetSpeedKmH: number
    checkpointIntervalKm?: number
    elevationWeight?: number
  }
}

/**
 * Cette fonction est exécutée dans le contexte 'MAIN' de la page Komoot.
 */
export async function injectWeatherOnKomootMap(
  payload: InjectedWeatherPayload,
  onSettingsChange?: (partialSettings: {
    checkpointIntervalKm?: number
    targetSpeedKmH?: number
    departureTime?: string
  }) => Promise<void>
): Promise<{
  success: boolean
  message?: string
}> {
  try {
    if (typeof onSettingsChange === 'function') {
      // @ts-expect-error global hook
      window.__velometeoOnSettingsChange = onSettingsChange
    }

    // Si l'overlay et la fonction de rafraîchissement existent déjà, mise à jour rapide sans reconstruction
    // @ts-expect-error global hook
    if (typeof window.__velometeoRefreshMarkers === 'function' && document.getElementById('velometeo-komoot-overlay')) {
      // @ts-expect-error global hook
      window.__velometeoRefreshMarkers(payload)
      return { success: true, message: 'Balises mises à jour.' }
    }

    // 1. Recherche robuste de la carte et de son conteneur (gère les classes CSS hashées de Komoot et les iframes)
    function ensureMapProject(m: any) {
      if (!m) return
      if (typeof m.project !== 'function') {
        if (typeof m.latLngToContainerPoint === 'function') {
          m.project = ([lon, lat]: [number, number]) => {
            const pt = m.latLngToContainerPoint([lat, lon])
            return { x: pt.x, y: pt.y }
          }
        } else if (typeof m.latLngToLayerPoint === 'function') {
          m.project = ([lon, lat]: [number, number]) => {
            const pt = m.latLngToLayerPoint([lat, lon])
            return { x: pt.x, y: pt.y }
          }
        }
      }
      if (typeof m.on !== 'function') {
        m.on = (evt: string, cb: () => void) => {
          if (typeof m.addEventListener === 'function') m.addEventListener(evt, cb)
        }
      }
      if (typeof m.off !== 'function') {
        m.off = (evt: string, cb: () => void) => {
          if (typeof m.removeEventListener === 'function') m.removeEventListener(evt, cb)
        }
      }
    }

    function createTerrainEngineAdapter(te: any, canvas: HTMLCanvasElement, container: HTMLElement) {
      return {
        project([lon, lat]: [number, number]) {
          try {
            const cam = te.getCamera?.()
            if (!cam?.getScreenPosition) return { x: -9999, y: -9999 }
            const pt = cam.getScreenPosition({ latitude: lat, longitude: lon })
            if (!pt || pt.isOccluded) return { x: -9999, y: -9999 }
            const w = canvas.offsetWidth || canvas.width || 1
            const h = canvas.offsetHeight || canvas.height || 1
            return { x: pt.x * w, y: pt.y * h }
          } catch {
            return { x: -9999, y: -9999 }
          }
        },
        on(_evt: string, cb: () => void) {
          if (typeof te.addPostUpdateListener === 'function') {
            try { te.addPostUpdateListener(cb) } catch {}
          }
          try {
            const cam = te.getCamera?.()
            if (cam && typeof cam.addInteractionListener === 'function') {
              cam.addInteractionListener(cb)
            }
          } catch {}
          canvas.addEventListener('wheel', cb, { passive: true })
          canvas.addEventListener('pointermove', cb, { passive: true })
          canvas.addEventListener('touchmove', cb, { passive: true })
          window.addEventListener('resize', cb)
        },
        off(_evt: string, cb: () => void) {
          if (typeof te.removePostUpdateListener === 'function') {
            try { te.removePostUpdateListener(cb) } catch {}
          }
          try {
            const cam = te.getCamera?.()
            if (cam && typeof cam.removeInteractionListener === 'function') {
              cam.removeInteractionListener(cb)
            }
          } catch {}
          canvas.removeEventListener('wheel', cb)
          canvas.removeEventListener('pointermove', cb)
          canvas.removeEventListener('touchmove', cb)
          window.removeEventListener('resize', cb)
        },
        getContainer() {
          return container
        },
      }
    }

    // 1. Recherche robuste de la carte et de son conteneur (Komoot, Strava, Leaflet, Mapbox, MapLibre)
    function findMapAndContainer(): { map: any; container: HTMLElement } | null { // eslint-disable-line @typescript-eslint/no-explicit-any
      const searchDocs: Document[] = [document]
      for (const iframe of Array.from(document.querySelectorAll('iframe'))) {
        try {
          if (iframe.contentDocument) searchDocs.push(iframe.contentDocument)
        } catch {
          // iframe cross-origin éventuelle ignorée
        }
      }

      for (const doc of searchDocs) {
        const win = (doc.defaultView || window) as any // eslint-disable-line @typescript-eslint/no-explicit-any
        const globalCandidate = win.stravaMap || win.komootMap || win.map || win.__map || win.__velometeoCapturedMap
        if (globalCandidate) {
          ensureMapProject(globalCandidate)
          if (typeof globalCandidate.project === 'function') {
            const el = globalCandidate.getContainer?.() || doc.querySelector('.maplibregl-canvas-container, .mapboxgl-map, .mapboxgl-canvas-container, .leaflet-container, [class*="Map_map"]')?.parentElement || doc.querySelector('.mapboxgl-map, .leaflet-container')
            if (el) return { map: globalCandidate, container: el as HTMLElement }
          }
        }

        // Strava namespace globals
        if (win.Strava) {
          const stravaCandidates = [
            win.Strava.map,
            win.Strava.page?.map,
            win.Strava.activityView?.map,
            win.Strava.routeBuilder?.map,
            win.Strava.Maps?.map,
          ]
          for (const cand of stravaCandidates) {
            if (cand) {
              ensureMapProject(cand)
              if (typeof cand.project === 'function') {
                const el = cand.getContainer?.() || doc.querySelector('.mapboxgl-map, .leaflet-container, [class*="Map_map"]')
                if (el) return { map: cand, container: el as HTMLElement }
              }
            }
          }
        }

        const docCanvases = Array.from(
          doc.querySelectorAll<HTMLCanvasElement>(
            'canvas.maplibregl-canvas, canvas.mapboxgl-canvas, .maplibregl-canvas-container canvas, .mapboxgl-canvas-container canvas, #canvas, [class*="CoreMap"] canvas, [class*="Map_map"] canvas, canvas'
          )
        ).filter((c) => (c.offsetWidth || c.width) > 100 && (c.offsetHeight || c.height) > 100)

        for (const canvas of docCanvases) {
          const container =
            (canvas.closest('.maplibregl-canvas-container')?.parentElement as HTMLElement) ||
            (canvas.closest('.mapboxgl-canvas-container')?.parentElement as HTMLElement) ||
            (canvas.closest('.mapboxgl-map') as HTMLElement) ||
            (canvas.closest('.leaflet-container') as HTMLElement) ||
            (canvas.closest('[class*="CoreMap_coreMap"]') as HTMLElement) ||
            (canvas.closest('[class*="Map_map"]') as HTMLElement) ||
            (canvas.closest('[class*="map-container"]') as HTMLElement) ||
            (canvas.parentElement?.parentElement as HTMLElement) ||
            (canvas.parentElement as HTMLElement)

          const elementsToSearch = [canvas, canvas.parentElement, container, container?.parentElement].filter(
            Boolean
          ) as HTMLElement[]

          for (const el of elementsToSearch) {
            // Propriétés directes
            for (const k of ['_map', 'map', '__map', 'maplibregl', 'mapboxgl', '__mapboxgl__', '_leaflet_map', '_leaflet']) {
              const m = (el as any)[k] // eslint-disable-line @typescript-eslint/no-explicit-any
              if (m) {
                ensureMapProject(m)
                if (typeof m.project === 'function') {
                  return { map: m, container }
                }
              }
            }

            // Arbre React Fiber (Komoot et Strava stockent leurs instances dans Props / Context / State)
            for (const prop of Object.getOwnPropertyNames(el)) {
              if (prop.startsWith('__reactFiber$') || prop.startsWith('__reactInternalInstance$')) {
                let curr = (el as any)[prop] // eslint-disable-line @typescript-eslint/no-explicit-any
                let depth = 0
                while (curr && depth < 60) {
                  const p = curr.memoizedProps
                  if (p) {
                    // Strava FATMAP CoreMap terrainEngine
                    const te = p.value?.terrainEngine || p.terrainEngine || p.value?.engine || p.engine
                    if (te && typeof te.getCamera === 'function') {
                      return { map: createTerrainEngineAdapter(te, canvas, container), container }
                    }

                    ensureMapProject(p)
                    if (typeof p.project === 'function') return { map: p, container }
                    if (p.map) {
                      ensureMapProject(p.map)
                      if (typeof p.map.project === 'function') return { map: p.map, container }
                    }
                    if (p.mapGl?.map) {
                      ensureMapProject(p.mapGl.map)
                      if (typeof p.mapGl.map.project === 'function') return { map: p.mapGl.map, container }
                    }
                    if (p.value?.map) {
                      ensureMapProject(p.value.map)
                      if (typeof p.value.map.project === 'function') return { map: p.value.map, container }
                    }
                    for (const k of Object.keys(p)) {
                      const val = p[k]
                      if (val && typeof val === 'object') {
                        const subTe = val.terrainEngine || val.engine
                        if (subTe && typeof subTe.getCamera === 'function') {
                          return { map: createTerrainEngineAdapter(subTe, canvas, container), container }
                        }
                        ensureMapProject(val)
                        if (typeof val.project === 'function') return { map: val, container }
                        if (val.map) {
                          ensureMapProject(val.map)
                          if (typeof val.map.project === 'function') return { map: val.map, container }
                        }
                      }
                    }
                  }

                  let state = curr.memoizedState
                  let sDepth = 0
                  while (state && sDepth < 35) {
                    const val = state.memoizedState
                    if (val && typeof val === 'object') {
                      const te = val.terrainEngine || val.current?.terrainEngine
                      if (te && typeof te.getCamera === 'function') {
                        return { map: createTerrainEngineAdapter(te, canvas, container), container }
                      }
                      ensureMapProject(val)
                      if (typeof val.project === 'function') return { map: val, container }
                      if (val.current) {
                        ensureMapProject(val.current)
                        if (typeof val.current.project === 'function') return { map: val.current, container }
                      }
                      if (val.map) {
                        ensureMapProject(val.map)
                        if (typeof val.map.project === 'function') return { map: val.map, container }
                      }
                    }
                    state = state.next
                    sDepth++
                  }

                  if (curr.stateNode && typeof curr.stateNode === 'object') {
                    const te = curr.stateNode.terrainEngine
                    if (te && typeof te.getCamera === 'function') {
                      return { map: createTerrainEngineAdapter(te, canvas, container), container }
                    }
                    ensureMapProject(curr.stateNode)
                    if (typeof curr.stateNode.project === 'function') return { map: curr.stateNode, container }
                    if (curr.stateNode.map) {
                      ensureMapProject(curr.stateNode.map)
                      if (typeof curr.stateNode.map.project === 'function') return { map: curr.stateNode.map, container }
                    }
                  }

                  curr = curr.return
                  depth++
                }
              }
            }
          }
        }
      }
      return null
    }

    // Gestion de l'attente du montage de la carte (Komoot & Strava)
    async function waitForMapAndContainer(): Promise<{ map: any; container: HTMLElement } | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
      const isStrava = window.location.hostname.includes('strava.')
      const isZoomView = window.location.pathname.includes('/zoom')

      for (let attempt = 0; attempt < 12; attempt++) {
        const res = findMapAndContainer()
        if (res) return res

        // Ne scroller vers 1100 que sur Komoot vue standard (pas sur Zoom ni sur Strava)
        if (attempt === 0 && !isZoomView && !isStrava) {
          window.scrollTo({ top: 1100, behavior: 'auto' })
        }
        await new Promise((r) => setTimeout(r, 350))
      }
      return null
    }

    const resolved = await waitForMapAndContainer()
    if (!resolved) {
      return {
        success: false,
        message: 'Impossible de localiser la carte sur la page. Attendez son chargement ou faites défiler jusqu’à elle.',
      }
    }

    const { map, container: mapContainer } = resolved

    // Sauvegarde globale pour réutilisation
    // @ts-expect-error global map storage
    window.komootMap = map

    // 2. Nettoyage d'un éventuel overlay précédent et des listeners
    // @ts-expect-error cleanup hook
    if (typeof window.__velometeoCleanup === 'function') {
      // @ts-expect-error cleanup hook
      window.__velometeoCleanup()
    }
    const oldOverlay = document.getElementById('velometeo-komoot-overlay')
    if (oldOverlay) oldOverlay.remove()
    const oldWidget = document.getElementById('velometeo-floating-widget')
    if (oldWidget) oldWidget.remove()

    // 3. Création du calque d'overlay superposé à la carte
    const overlay = document.createElement('div')
    overlay.id = 'velometeo-komoot-overlay'
    overlay.style.position = 'absolute'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100%'
    overlay.style.height = '100%'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '5'
    overlay.style.overflow = 'hidden'

    mapContainer.style.position = 'relative'
    mapContainer.appendChild(overlay)

    const markerEls: Array<{ el: HTMLElement; lon: number; lat: number; bearing: number }> = []

    function createMarkerElement(cp: InjectedWeatherPayload['checkpoints'][0]): HTMLElement {
      const marker = document.createElement('div')
      marker.style.position = 'absolute'
      marker.style.transform = 'translate(-50%, -50%)'
      marker.style.pointerEvents = 'auto'
      marker.style.cursor = 'pointer'
      marker.style.transition = 'transform 0.15s ease'
      marker.style.zIndex = '10'

      marker.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(6px);
          color: white;
          padding: 3px 8px;
          border-radius: 9999px;
          border: 2px solid ${cp.windCategoryColor};
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        ">
          <span style="font-size: 10px; font-weight: 600; opacity: 0.85;">${cp.estimatedTimeStr}</span>
          <span style="font-size: 12px; line-height: 1;">${cp.weatherIcon}</span>
          <div style="
            width: 17px;
            height: 17px;
            border-radius: 9999px;
            background: ${cp.windCategoryColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            line-height: 1;
            color: white;
          ">
            <span style="transform: rotate(${cp.windDirection + 180}deg); display: inline-block;">➔</span>
          </div>
          <span>${Math.round(cp.temperature)}°</span>
          <span style="font-size: 10px; opacity: 0.85;">${cp.windSpeed}k</span>
        </div>
      `

      // Tooltip au survol
      const tooltip = document.createElement('div')
      tooltip.style.display = 'none'
      tooltip.style.position = 'absolute'
      tooltip.style.bottom = '120%'
      tooltip.style.left = '50%'
      tooltip.style.transform = 'translateX(-50%)'
      tooltip.style.background = '#0f172a'
      tooltip.style.color = '#ffffff'
      tooltip.style.padding = '8px 10px'
      tooltip.style.borderRadius = '8px'
      tooltip.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.5)'
      tooltip.style.fontSize = '11px'
      tooltip.style.lineHeight = '1.3'
      tooltip.style.width = '190px'
      tooltip.style.zIndex = '100'
      tooltip.style.pointerEvents = 'none'

      tooltip.innerHTML = `
        <div style="font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>Passage : ${cp.estimatedTimeStr}</span>
          <span style="color: #60a5fa;">${cp.distKm} km</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="font-size: 16px;">${cp.weatherIcon}</span>
          <span>${cp.weatherLabel} (${cp.temperature}°C)</span>
        </div>
        <div style="color: ${cp.windCategoryColor}; font-weight: bold;">
          ${cp.windCategoryLabel} (${cp.windSpeed} km/h)
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
          Rafales : ${cp.windGusts} km/h • Pluie : ${cp.precipitationProb}% (${cp.precipitationMm} mm)
        </div>
      `
      marker.appendChild(tooltip)

      marker.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block'
        marker.style.transform = 'translate(-50%, -50%) scale(1.1)'
        marker.style.zIndex = '50'
      })
      marker.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none'
        marker.style.transform = 'translate(-50%, -50%) scale(1)'
        marker.style.zIndex = '10'
      })

      return marker
    }

    function updateMarkerPositions() {
      if (markerEls.length === 0) return

      const rawPoints: Array<{ x: number; y: number; bearing?: number }> = []
      for (const item of markerEls) {
        try {
          const pt = map.project([item.lon, item.lat])
          rawPoints.push({ x: pt.x, y: pt.y, bearing: item.bearing })
        } catch {
          rawPoints.push({ x: 0, y: 0, bearing: item.bearing })
        }
      }

      // Dé-collision des balises (décalage latéral selon cap aller/retour + relaxation d'évitement)
      const deCollided = computeDeCollidedPositions(rawPoints, {
        lateralOffset: 18,
        pillWidth: 95,
        pillHeight: 26,
      })

      for (let i = 0; i < markerEls.length; i++) {
        const el = markerEls[i].el
        const pos = deCollided[i]
        if (pos.x < -100 || pos.y < -100 || pos.x > 10000 || pos.y > 10000) {
          el.style.display = 'none'
        } else {
          el.style.display = 'block'
          el.style.left = `${Math.round(pos.x)}px`
          el.style.top = `${Math.round(pos.y)}px`
        }
      }
    }

    function renderMarkers(checkpoints: InjectedWeatherPayload['checkpoints']) {
      overlay.innerHTML = ''
      markerEls.length = 0

      checkpoints.forEach((cp) => {
        const marker = createMarkerElement(cp)
        overlay.appendChild(marker)
        markerEls.push({
          el: marker,
          lon: cp.lon,
          lat: cp.lat,
          bearing: cp.bearing ?? 0,
        })
      })

      updateMarkerPositions()
    }

    // Rendu initial des marqueurs
    renderMarkers(payload.checkpoints)

    // Abonnement aux événements de déplacement de la carte Mapbox/MapLibre
    map.on('move', updateMarkerPositions)
    map.on('zoom', updateMarkerPositions)
    map.on('resize', updateMarkerPositions)

    // 5. Widget flottant VeloMétéo avec Sliders interactifs
    const isZoomView = window.location.pathname.includes('/zoom')
    const isStrava = window.location.hostname.includes('strava.')
    const widget = document.createElement('div')
    widget.id = 'velometeo-floating-widget'
    widget.style.position = 'absolute'
    if (isZoomView) {
      widget.style.top = '135px'
      widget.style.right = '70px'
      widget.style.left = 'auto'
    } else if (isStrava) {
      widget.style.top = '70px'
      widget.style.right = '20px'
      widget.style.left = 'auto'
    } else {
      widget.style.top = '12px'
      widget.style.left = '12px'
      widget.style.right = 'auto'
    }
    widget.style.zIndex = '500'
    widget.style.background = 'rgba(255, 255, 255, 0.96)'
    widget.style.backdropFilter = 'blur(10px)'
    widget.style.borderRadius = '14px'
    widget.style.padding = '12px 14px'
    widget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.06)'
    widget.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    widget.style.width = '265px'
    widget.style.color = '#0f172a'
    widget.style.userSelect = 'none'

    const intervalVal = payload.settings.checkpointIntervalKm ?? 10
    const speedVal = payload.settings.targetSpeedKmH ?? 25
    const departureVal = payload.settings.departureTime

    widget.innerHTML = `
      <div id="velometeo-drag-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: grab;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 22px; height: 22px; background: #2563eb; color: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
            🚴
          </div>
          <span style="font-weight: 800; font-size: 13px; letter-spacing: -0.2px;">VeloMétéo</span>
          <span id="velometeo-loading-badge" style="display: none; font-size: 10px; color: #2563eb; font-weight: 700; background: #eff6ff; padding: 1px 5px; border-radius: 4px;">Calcul...</span>
        </div>
        <button id="velometeo-toggle-btn" style="background: #f1f5f9; border: none; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; color: #475569;">
          Masquer
        </button>
      </div>

      <div id="velometeo-widget-body">
        <div style="margin-bottom: 8px;">
          <div id="velometeo-dominant-wind" style="font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
            ${payload.summary.dominantWindLabel}
          </div>
          <div id="velometeo-wind-stats" style="font-size: 10px; color: #64748b; margin-bottom: 5px;">
            Vent moy. ${payload.summary.avgWindSpeedKmH} km/h • Rafales ${payload.summary.maxGustKmH} km/h
          </div>

          <!-- Jauge vent relatif -->
          <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; margin-bottom: 2px;">
            <span id="velometeo-val-head" style="color: #ef4444;">Face ${payload.summary.headwindPercent}%</span>
            <span id="velometeo-val-cross" style="color: #eab308;">Côté ${payload.summary.crosswindPercent}%</span>
            <span id="velometeo-val-tail" style="color: #10b981;">Dos ${payload.summary.tailwindPercent}%</span>
          </div>
          <div style="height: 5px; width: 100%; background: #e2e8f0; border-radius: 9999px; overflow: hidden; display: flex;">
            <div id="velometeo-bar-head" style="width: ${payload.summary.headwindPercent}%; background: #ef4444; transition: width 0.3s ease;"></div>
            <div id="velometeo-bar-cross" style="width: ${payload.summary.crosswindPercent}%; background: #eab308; transition: width 0.3s ease;"></div>
            <div id="velometeo-bar-tail" style="width: ${payload.summary.tailwindPercent}%; background: #10b981; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Section Réglages Sliders -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; flex-direction: column; gap: 7px;">
          <!-- Slider Espacement Météo -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 2px;">
              <span style="font-weight: 600; color: #334155;">📍 Espacement balises</span>
              <span id="velometeo-val-interval" style="font-weight: 700; color: #7c3aed; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 1px 5px; border-radius: 4px; font-size: 10px;">${intervalVal} km</span>
            </div>
            <input type="range" id="velometeo-slider-interval" min="3" max="30" step="1" value="${intervalVal}" style="width: 100%; accent-color: #7c3aed; cursor: pointer; height: 4px; margin: 3px 0; display: block;">
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
              <span>3 km</span>
              <span>10 km</span>
              <span>30 km</span>
            </div>
          </div>

          <!-- Slider Vitesse moyenne cible -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 2px;">
              <span style="font-weight: 600; color: #334155;">⚡ Vitesse moyenne</span>
              <span id="velometeo-val-speed" style="font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 5px; border-radius: 4px; font-size: 10px;">${speedVal} km/h</span>
            </div>
            <input type="range" id="velometeo-slider-speed" min="15" max="42" step="1" value="${speedVal}" style="width: 100%; accent-color: #059669; cursor: pointer; height: 4px; margin: 3px 0; display: block;">
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
              <span>15 km/h</span>
              <span>25 km/h</span>
              <span>42 km/h</span>
            </div>
          </div>

          <!-- Heure de départ -->
          <div>
            <div style="font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 2px;">
              🕐 Date & heure de départ
            </div>
            <input type="datetime-local" id="velometeo-input-departure" value="${departureVal}" style="width: 100%; padding: 4px 6px; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; color: #0f172a; font-family: inherit; box-sizing: border-box;">
          </div>
        </div>
      </div>
    `
    mapContainer.appendChild(widget)

    function updateWidgetContent(summary: InjectedWeatherPayload['summary'], settings: InjectedWeatherPayload['settings']) {
      if (!widget) return

      const domWind = widget.querySelector('#velometeo-dominant-wind')
      if (domWind) domWind.textContent = summary.dominantWindLabel

      const windStats = widget.querySelector('#velometeo-wind-stats')
      if (windStats) windStats.textContent = `Vent moy. ${summary.avgWindSpeedKmH} km/h • Rafales ${summary.maxGustKmH} km/h`

      const barHead = widget.querySelector('#velometeo-bar-head') as HTMLElement
      if (barHead) barHead.style.width = `${summary.headwindPercent}%`
      const valHead = widget.querySelector('#velometeo-val-head')
      if (valHead) valHead.textContent = `Face ${summary.headwindPercent}%`

      const barCross = widget.querySelector('#velometeo-bar-cross') as HTMLElement
      if (barCross) barCross.style.width = `${summary.crosswindPercent}%`
      const valCross = widget.querySelector('#velometeo-val-cross')
      if (valCross) valCross.textContent = `Côté ${summary.crosswindPercent}%`

      const barTail = widget.querySelector('#velometeo-bar-tail') as HTMLElement
      if (barTail) barTail.style.width = `${summary.tailwindPercent}%`
      const valTail = widget.querySelector('#velometeo-val-tail')
      if (valTail) valTail.textContent = `Dos ${summary.tailwindPercent}%`

      if (settings.checkpointIntervalKm) {
        const valInterval = widget.querySelector('#velometeo-val-interval')
        if (valInterval) valInterval.textContent = `${settings.checkpointIntervalKm} km`
      }

      if (settings.targetSpeedKmH) {
        const valSpeed = widget.querySelector('#velometeo-val-speed')
        if (valSpeed) valSpeed.textContent = `${settings.targetSpeedKmH} km/h`
      }
    }

    // Gestion de l'actualisation globale des données (appelée lors des changements de sliders)
    // @ts-expect-error global hook
    window.__velometeoRefreshMarkers = (newPayload: InjectedWeatherPayload) => {
      renderMarkers(newPayload.checkpoints)
      updateWidgetContent(newPayload.summary, newPayload.settings)
      const badge = widget.querySelector('#velometeo-loading-badge') as HTMLElement
      if (badge) badge.style.display = 'none'
    }

    // Écouteurs sur les sliders avec debounce
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const triggerUpdate = (partial: { checkpointIntervalKm?: number; targetSpeedKmH?: number; departureTime?: string }) => {
      const badge = widget.querySelector('#velometeo-loading-badge') as HTMLElement
      if (badge) badge.style.display = 'inline'

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        // @ts-expect-error global hook
        if (typeof window.__velometeoOnSettingsChange === 'function') {
          // @ts-expect-error global hook
          window.__velometeoOnSettingsChange(partial)
        }
      }, 220)
    }

    const sliderInterval = widget.querySelector('#velometeo-slider-interval') as HTMLInputElement
    sliderInterval?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value)
      const valLabel = widget.querySelector('#velometeo-val-interval')
      if (valLabel) valLabel.textContent = `${val} km`
      triggerUpdate({ checkpointIntervalKm: val })
    })

    const sliderSpeed = widget.querySelector('#velometeo-slider-speed') as HTMLInputElement
    sliderSpeed?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value)
      const valLabel = widget.querySelector('#velometeo-val-speed')
      if (valLabel) valLabel.textContent = `${val} km/h`
      triggerUpdate({ targetSpeedKmH: val })
    })

    const inputDeparture = widget.querySelector('#velometeo-input-departure') as HTMLInputElement
    inputDeparture?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value
      triggerUpdate({ departureTime: val })
    })

    // Bouton pour afficher/masquer les marqueurs et le contenu du widget
    const toggleBtn = widget.querySelector('#velometeo-toggle-btn') as HTMLButtonElement
    let isVisible = true
    toggleBtn?.addEventListener('click', () => {
      isVisible = !isVisible
      overlay.style.display = isVisible ? 'block' : 'none'
      const body = widget.querySelector('#velometeo-widget-body') as HTMLElement
      if (body) body.style.display = isVisible ? 'block' : 'none'
      toggleBtn.textContent = isVisible ? 'Masquer' : 'Afficher'
    })

    // Rendre le widget déplaçable (drag & drop)
    const dragHeader = (widget.querySelector('#velometeo-drag-header') as HTMLElement) || widget
    let isDragging = false
    let startX = 0
    let startY = 0
    let initialLeft = 0
    let initialTop = 0

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, input')) return
      isDragging = true
      dragHeader.style.cursor = 'grabbing'
      startX = e.clientX
      startY = e.clientY
      const rect = widget.getBoundingClientRect()
      const parentRect = mapContainer.getBoundingClientRect()
      initialLeft = rect.left - parentRect.left
      initialTop = rect.top - parentRect.top
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      widget.style.left = `${initialLeft + dx}px`
      widget.style.top = `${initialTop + dy}px`
      widget.style.right = 'auto'
    }

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false
        dragHeader.style.cursor = 'grab'
      }
    }

    dragHeader.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Enregistrement du nettoyeur pour les futures réinjections
    // @ts-expect-error cleanup hook
    window.__velometeoCleanup = () => {
      try {
        map.off('move', updateMarkerPositions)
        map.off('zoom', updateMarkerPositions)
        map.off('resize', updateMarkerPositions)
        dragHeader.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      } catch {
        // ignore
      }
    }

    // Défilement doux vers la carte pour une visibilité immédiate (Komoot)
    if (!isStrava) {
      mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    return {
      success: true,
      message: `${payload.checkpoints.length} balises météo superposées sur la carte.`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, message: msg }
  }
}

export const injectWeatherOnMap = injectWeatherOnKomootMap

