import { useEffect } from 'react'
import Sidebar from './Sidebar'
import useCharacterStore from '../store/characterStore'
import useStripStore from '../store/stripStore'
import useBackgroundStore from '../store/backgroundStore'
import useObjectStore from '../store/objectStore'
import useBalloonStore from '../store/balloonStore'
import useProjectStore from '../store/projectStore'

export default function Layout({ children, currentView, onNavigate, activeProject, onExitProject }) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await useProjectStore.getState().load()
      if (cancelled) return
      await useCharacterStore.getState().load()
      await useBackgroundStore.getState().load()
      await useObjectStore.getState().load()
      await useBalloonStore.getState().load()
      await useStripStore.getState().load()
      await useProjectStore.getState().migrate()
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
