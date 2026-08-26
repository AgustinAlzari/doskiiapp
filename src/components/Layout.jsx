import { useEffect } from 'react'
import Sidebar from './Sidebar'
import useCharacterStore from '../store/characterStore'
import useStripStore from '../store/stripStore'
import useBackgroundStore from '../store/backgroundStore'
import useObjectStore from '../store/objectStore'
import useBalloonStore from '../store/balloonStore'
import usePaletteStore from '../store/paletteStore'
import useAuthorStore from '../store/authorStore'
import useProjectStore from '../store/projectStore'
import useTiraStore from '../store/tiraStore'

export default function Layout({ children, currentView, onNavigate, activeProject, onExitProject, onToggleMode }) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const step = async (label, fn) => {
        try { await fn() } catch (e) { console.error(`[doski init] ${label}:`, e) }
      }
      // Paralelo: cada store lee su carpeta sin dependencias; migrate queda después.
      await Promise.all([
        step('projects.load', () => useProjectStore.getState().load()),
        step('characters.load', () => useCharacterStore.getState().load()),
        step('backgrounds.load', () => useBackgroundStore.getState().load()),
        step('objects.load', () => useObjectStore.getState().load()),
        step('balloons.load', () => useBalloonStore.getState().load()),
        step('palettes.load', () => usePaletteStore.getState().load()),
        step('authors.load', () => useAuthorStore.getState().load()),
        step('strips.load', () => useStripStore.getState().load()),
        step('tiras.load', () => useTiraStore.getState().load()),
      ])
      if (cancelled) return
      await step('migrate', () => useProjectStore.getState().migrate())
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div className="title-drag-region" />
      <Sidebar currentView={currentView} onNavigate={onNavigate} activeProject={activeProject} onExitProject={onExitProject} onToggleMode={onToggleMode} />
      <main className="app-main" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Área scrolleable que arranca DEBAJO de la barra de título (y=48): así el
            contenido nunca asoma por encima del header fijo al scrollear y las
            imágenes se ocultan de verdad detrás del sticky header de "preview". */}
        <div style={{ position: 'absolute', top: 48, right: 0, bottom: 0, left: 0, overflow: 'auto', padding: '0 32px 32px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
