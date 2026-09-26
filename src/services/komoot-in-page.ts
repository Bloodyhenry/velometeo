/**
 * Script injecté directement dans la page Komoot (world: 'MAIN')
 * pour afficher les balises météo et la jauge de vent directement sur la carte MapLibre/Mapbox.
 */

export interface InjectedWeatherPayload {
  checkpoints: Array<{
    id: string
    lat: number
    lon: number
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
  }
}

/**
 * Cette fonction est sérialisée et injectée dans le contexte 'MAIN' de la page Komoot.
 */
export async function injectWeatherOnKomootMap(payload: InjectedWeatherPayload): Promise<{
  success: boolean
  message?: string
}> {
  try {
    // 1. Recherche robuste de la carte et de son conteneur (gère les classes CSS hashées de Komoot et les iframes)
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
        const globalCandidate = win.komootMap || win.map || win.__map
        if (globalCandidate && typeof globalCandidate.project === 'function') {
          const el = globalCandidate.getContainer?.() || doc.querySelector('.maplibregl-canvas-container')?.parentElement
          if (el) return { map: globalCandidate, container: el as HTMLElement }
        }

        const docCanvases = Array.from(
          doc.querySelectorAll<HTMLCanvasElement>(
            'canvas.maplibregl-canvas, canvas.mapboxgl-canvas, .maplibregl-canvas-container canvas, canvas'
          )
        ).filter((c) => (c.offsetWidth || c.width) > 100 && (c.offsetHeight || c.height) > 100)

        for (const canvas of docCanvases) {
          const container =
            (canvas.closest('.maplibregl-canvas-container')?.parentElement as HTMLElement) ||
            (canvas.parentElement?.parentElement as HTMLElement) ||
            (canvas.parentElement as HTMLElement)

          const elementsToSearch = [canvas, canvas.parentElement, container, container?.parentElement].filter(
            Boolean
          ) as HTMLElement[]

          for (const el of elementsToSearch) {
            // Propriétés directes
            for (const k of ['_map', 'map', '__map', 'maplibregl', 'mapboxgl']) {
              const m = (el as any)[k] // eslint-disable-line @typescript-eslint/no-explicit-any
              if (m && typeof m.project === 'function') {
                return { map: m, container }
              }
            }

            // Arbre React Fiber (Komoot stocke l'instance MapLibre dans Context / props / hooks)
            for (const prop of Object.getOwnPropertyNames(el)) {
              if (prop.startsWith('__reactFiber$') || prop.startsWith('__reactInternalInstance$')) {
                let curr = (el as any)[prop] // eslint-disable-line @typescript-eslint/no-explicit-any
                let depth = 0
                while (curr && depth < 60) {
                  const p = curr.memoizedProps
                  if (p) {
                    if (typeof p.project === 'function') return { map: p, container }
                    if (p.map && typeof p.map.project === 'function') return { map: p.map, container }
                    if (p.mapGl?.map && typeof p.mapGl.map.project === 'function') return { map: p.mapGl.map, container }
                    if (p.value?.map && typeof p.value.map.project === 'function') return { map: p.value.map, container }
                    for (const k of Object.keys(p)) {
                      const val = p[k]
                      if (val && typeof val === 'object') {
                        if (typeof val.project === 'function') return { map: val, container }
                        if (val.map && typeof val.map.project === 'function') return { map: val.map, container }
                      }
                    }
                  }

                  let state = curr.memoizedState
                  let sDepth = 0
                  while (state && sDepth < 35) {
                    const val = state.memoizedState
                    if (val && typeof val === 'object') {
                      if (typeof val.project === 'function') return { map: val, container }
                      if (val.current && typeof val.current.project === 'function') return { map: val.current, container }
                      if (val.map && typeof val.map.project === 'function') return { map: val.map, container }
                    }
                    state = state.next
                    sDepth++
                  }

                  if (curr.stateNode && typeof curr.stateNode === 'object') {
                    if (typeof curr.stateNode.project === 'function') return { map: curr.stateNode, container }
                    if (curr.stateNode.map && typeof curr.stateNode.map.project === 'function') return { map: curr.stateNode.map, container }
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

    // Gestion du lazy-loading Komoot (sur la vue standard, la carte n'est montée que lors du défilement)
    async function waitForMapAndContainer(): Promise<{ map: any; container: HTMLElement } | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = findMapAndContainer()
        if (res) return res

        if (attempt === 0 && !window.location.pathname.includes('/zoom')) {
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
        message: 'Impossible de localiser la carte Komoot sur la page. Faites défiler jusqu’à la carte ou attendez son chargement.',
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

    // 4. Création des balises météo interactives
    const markerEls: Array<{ el: HTMLElement; lon: number; lat: number }> = []

    payload.checkpoints.forEach((cp) => {
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
          gap: 4px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(4px);
          color: white;
          padding: 3px 6px;
          border-radius: 9999px;
          border: 2px solid ${cp.windCategoryColor};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          font-family: system-ui, sans-serif;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        ">
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 9999px;
            background: ${cp.windCategoryColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
          ">
            <span style="transform: rotate(${cp.windDirection + 180}deg); display: inline-block;">➔</span>
          </div>
          <span>${Math.round(cp.temperature)}°</span>
          <span style="font-size: 10px; opacity: 0.9;">${cp.windSpeed}k</span>
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
        <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">
          Rafales : ${cp.windGusts} km/h • Pluie : ${cp.precipitationProb}%
        </div>
      `
      marker.appendChild(tooltip)

      let tooltipOpen = false
      const showTooltip = () => {
        marker.style.transform = 'translate(-50%, -50%) scale(1.15)'
        marker.style.zIndex = '50'
        tooltip.style.display = 'block'
      }
      const hideTooltip = () => {
        if (!tooltipOpen) {
          marker.style.transform = 'translate(-50%, -50%) scale(1)'
          marker.style.zIndex = '10'
          tooltip.style.display = 'none'
        }
      }

      marker.addEventListener('mouseenter', showTooltip)
      marker.addEventListener('mouseleave', hideTooltip)
      marker.addEventListener('click', (e) => {
        e.stopPropagation()
        tooltipOpen = !tooltipOpen
        if (tooltipOpen) showTooltip()
        else {
          marker.style.transform = 'translate(-50%, -50%) scale(1)'
          marker.style.zIndex = '10'
          tooltip.style.display = 'none'
        }
      })

      overlay.appendChild(marker)
      markerEls.push({ el: marker, lon: cp.lon, lat: cp.lat })
    })

    // 5. Fonction de mise à jour des positions écran lors des mouvements de carte
    function updateMarkerPositions() {
      for (const item of markerEls) {
        try {
          const pt = map.project([item.lon, item.lat])
          item.el.style.left = `${Math.round(pt.x)}px`
          item.el.style.top = `${Math.round(pt.y)}px`
        } catch {
          // ignore
        }
      }
    }

    // Mise à jour immédiate
    updateMarkerPositions()

    // Abonnement aux événements de déplacement de la carte Mapbox/MapLibre
    map.on('move', updateMarkerPositions)
    map.on('zoom', updateMarkerPositions)
    map.on('resize', updateMarkerPositions)

    // Enregistrement du nettoyeur pour les futures réinjections
    // @ts-expect-error cleanup hook
    window.__velometeoCleanup = () => {
      try {
        map.off('move', updateMarkerPositions)
        map.off('zoom', updateMarkerPositions)
        map.off('resize', updateMarkerPositions)
      } catch {
        // ignore
      }
    }

    // 6. Widget flottant VeloMétéo
    const isZoomView = window.location.pathname.includes('/zoom')
    const widget = document.createElement('div')
    widget.id = 'velometeo-floating-widget'
    widget.style.position = 'absolute'
    if (isZoomView) {
      // Sur la vue /zoom, le volet de gauche Komoot occupe ~400px. On place le widget à droite sous les boutons d'action.
      widget.style.top = '135px'
      widget.style.right = '70px'
      widget.style.left = 'auto'
    } else {
      widget.style.top = '12px'
      widget.style.left = '12px'
      widget.style.right = 'auto'
    }
    widget.style.zIndex = '500'
    widget.style.background = 'rgba(255, 255, 255, 0.95)'
    widget.style.backdropFilter = 'blur(10px)'
    widget.style.borderRadius = '14px'
    widget.style.padding = '10px 14px'
    widget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.06)'
    widget.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    widget.style.width = '250px'
    widget.style.color = '#0f172a'
    widget.style.userSelect = 'none'

    widget.innerHTML = `
      <div id="velometeo-drag-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; cursor: grab;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 22px; height: 22px; background: #2563eb; color: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
            🚴
          </div>
          <span style="font-weight: 800; font-size: 13px; letter-spacing: -0.2px;">VeloMétéo</span>
        </div>
        <button id="velometeo-toggle-btn" style="background: #f1f5f9; border: none; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; color: #475569;">
          Masquer
        </button>
      </div>

      <div style="font-size: 11px; margin-bottom: 6px; color: #334155;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Départ : <strong>${new Date(payload.settings.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
          <span>Vitesse : <strong>${payload.settings.targetSpeedKmH} km/h</strong></span>
        </div>
        <div style="font-weight: 600; color: #0f172a;">${payload.summary.dominantWindLabel}</div>
      </div>

      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; margin-bottom: 3px;">
          <span style="color: #ef4444;">Face: ${payload.summary.headwindPercent}%</span>
          <span style="color: #eab308;">Côté: ${payload.summary.crosswindPercent}%</span>
          <span style="color: #10b981;">Dos: ${payload.summary.tailwindPercent}%</span>
        </div>
        <div style="height: 5px; width: 100%; background: #e2e8f0; border-radius: 9999px; overflow: hidden; display: flex;">
          <div style="width: ${payload.summary.headwindPercent}%; background: #ef4444;"></div>
          <div style="width: ${payload.summary.crosswindPercent}%; background: #eab308;"></div>
          <div style="width: ${payload.summary.tailwindPercent}%; background: #10b981;"></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        <span>Vent moy. <strong>${payload.summary.avgWindSpeedKmH} km/h</strong></span>
        <span>Rafales <strong>${payload.summary.maxGustKmH} km/h</strong></span>
      </div>
    `

    mapContainer.appendChild(widget)

    // Bouton pour afficher/masquer les marqueurs
    const toggleBtn = widget.querySelector('#velometeo-toggle-btn') as HTMLButtonElement
    let isVisible = true
    toggleBtn?.addEventListener('click', () => {
      isVisible = !isVisible
      overlay.style.display = isVisible ? 'block' : 'none'
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
      if ((e.target as HTMLElement).closest('button')) return
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

    // Défilement doux vers la carte pour une visibilité immédiate
    mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })

    return {
      success: true,
      message: `${payload.checkpoints.length} balises météo superposées sur la carte Komoot.`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, message: msg }
  }
}
