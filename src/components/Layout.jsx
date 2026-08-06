import { useEffect } from 'react'
import Sidebar from './Sidebar'
import useCharacterStore from '../store/characterStore'
import useStripStore from '../store/stripStore'
import useBackgroundStore from '../store/backgroundStore'
import useObjectStore from '../store/objectStore'

export default function Layout({ children, currentView, onNavigate }) {
  useEffect(() => {
    useCharacterStore.getState().load()
    useStripStore.getState().load()
    useBackgroundStore.getState().load()
    useObjectStore.getState().load()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar currentView={currentView} onNavigate={onNavigate} />
      <main className="app-main" style={{ flex: 1, overflow: 'auto', padding: '48px 32px 32px' }}>
        {children}
      </main>
    </div>
  )
}
