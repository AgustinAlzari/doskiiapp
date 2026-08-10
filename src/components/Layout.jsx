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

export default function Layout({ children, currentView, onNavigate, activeProject, onExitProject }) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const step = async (label, fn) => {
        try { await fn() } catch (e) { console.error(`[doski init] ${label}:`, e) }
      }
      await step('projects.load', () => useProjectStore.getState().load())
      if (cancelled) return
      await step('characters.load', () => useCharacterStore.getState().load())
      await step('backgrounds.load', () => useBackgroundStore.getState().load())
      await step('objects.load', () => useObjectStore.getState().load())
      await step('balloons.load', () => useBalloonStore.getState().load())
      await step('palettes.load', () => usePaletteStore.getState().load())
      await step('authors.load', () => useAuthorStore.getState().load())
      await step('strips.load', () => useStripStore.getState().load())
      await step('migrate', () => useProjectStore.getState().migrate())
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div className="title-drag-region" />
      <Sidebar currentView={currentView} onNavigate={onNavigate} activeProject={activeProject} onExitProject={onExitProject} />
      <main className="app-main" style={{ flex: 1, overflow: 'auto', padding: '48px 32px 32px' }}>
        {children}
      </main>
    </div>
  )
}
