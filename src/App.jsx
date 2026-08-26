import { useEffect, useRef, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import StripList from './components/StripList'
import StripCreator from './components/editor/StripCreator'
import StripEditor from './components/editor/StripEditor'
import CharacterList from './components/characters/CharacterList'
import CharacterForm from './components/characters/CharacterForm'
import BackgroundList from './components/backgrounds/BackgroundList'
import BackgroundForm from './components/backgrounds/BackgroundForm'
import ObjectList from './components/objects/ObjectList'
import ObjectForm from './components/objects/ObjectForm'
import BalloonList from './components/balloons/BalloonList'
import BalloonForm from './components/balloons/BalloonForm'
import ReferenceList from './components/references/ReferenceList'
import ReferenceForm from './components/references/ReferenceForm'
import AuthorList from './components/authors/AuthorList'
import AuthorForm from './components/authors/AuthorForm'
import ProjectList from './components/projects/ProjectList'
import ProjectForm from './components/projects/ProjectForm'
import PromptExporter from './components/export/PromptExporter'
import PreviewExport from './components/export/PreviewExport'
import ModelList from './components/ModelList'
import SyncWizard from './components/SyncWizard'
import useProjectStore from './store/projectStore'
import useStripStore from './store/stripStore'
import useTiraStore from './store/tiraStore'
import useCharacterStore from './store/characterStore'
import useBackgroundStore from './store/backgroundStore'
import useObjectStore from './store/objectStore'
import useBalloonStore from './store/balloonStore'
import useReferenceStore from './store/referenceStore'
import usePaletteStore from './store/paletteStore'
import useAuthorStore from './store/authorStore'
import ChatPanel from './components/chat/ChatPanel'
import AutoSaveToast from './components/AutoSaveToast'
import ConfirmDialog from './components/ConfirmDialog'
import useChatStore from './store/chatStore'

const SCOPED_VIEWS = [
  'strips', 'new-strip', 'editor', 'prompts', 'export',
  'characters', 'new-character', 'edit-character',
  'backgrounds', 'new-background', 'edit-background',
  'objects', 'new-object', 'edit-object',
  'balloons', 'new-balloon', 'edit-balloon',
  'references', 'new-reference', 'edit-reference',
  'authors', 'new-author', 'edit-author',
]

export default function App() {
  const [view, setView] = useState('projects')
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [selectedStripId, setSelectedStripId] = useState(null)
  const [tiraReturnId, setTiraReturnId] = useState(null)
  const [editingCharacter, setEditingCharacter] = useState(null)
  const [editingBackground, setEditingBackground] = useState(null)
  const [editingObject, setEditingObject] = useState(null)
  const [editingBalloon, setEditingBalloon] = useState(null)
  const [editingReference, setEditingReference] = useState(null)
  const [editingAuthor, setEditingAuthor] = useState(null)
  const [promptData, setPromptData] = useState(null)
  const [backupConfig, setBackupConfig] = useState(null)
  const [backupReady, setBackupReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const setChatOpen = useChatStore(s => s.setOpen)
  const userStartedRef = useRef(false)

  const reloadAllStores = async () => {
    // En paralelo: cada store lee su carpeta; no hay dependencias entre ellos.
    await Promise.all([
      useProjectStore.getState().load(),
      useCharacterStore.getState().load(),
      useBackgroundStore.getState().load(),
      useObjectStore.getState().load(),
      useBalloonStore.getState().load(),
      useReferenceStore.getState().load(),
      useStripStore.getState().load(),
      useTiraStore.getState().load(),
      usePaletteStore.getState().load(),
      useAuthorStore.getState().load(),
    ])
  }

  const reloadAllStoresIncremental = async (changed) => {
    if (!changed || !Array.isArray(changed) || changed.length === 0) return reloadAllStores()
    const subs = new Set(changed.map(p => String(p).split('/')[0]))
    const loads = []
    if (subs.has('projects')) loads.push(useProjectStore.getState().load())
    if (subs.has('characters')) loads.push(useCharacterStore.getState().load())
    if (subs.has('backgrounds')) loads.push(useBackgroundStore.getState().load())
    if (subs.has('objects')) loads.push(useObjectStore.getState().load())
    if (subs.has('balloons')) loads.push(useBalloonStore.getState().load())
    if (subs.has('referenceDefs') || subs.has('references')) loads.push(useReferenceStore.getState().load())
    if (subs.has('strips')) loads.push(useStripStore.getState().load())
    if (subs.has('tiras')) loads.push(useTiraStore.getState().load())
    if (subs.has('palettes')) loads.push(usePaletteStore.getState().load())
    if (subs.has('authors')) loads.push(useAuthorStore.getState().load())
    // references es carpeta de archivos sueltos, no store directo, pero si cambia solo refs no hace falta recargar stores
    if (loads.length === 0) return
    await Promise.all(loads)
  }

  const refreshAndReload = async () => {
    let changed = null
    try {
      if (window.api?.backup?.refresh) {
        const res = await window.api.backup.refresh()
        changed = res?.changed || null
      }
    } catch (e) { console.error('actualizar desde la nube falló:', e) }
    if (changed) await reloadAllStoresIncremental(changed)
    else await reloadAllStores()
    return changed
  }

  // Sincroniza en segundo plano: muestra un aviso "actualizando..." mientras
  // descarga la nube y recarga los stores, pero sin bloquear la navegación (stale-while-revalidate).
  const syncingRef = useRef(false)
  const syncInBackground = () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    refreshAndReload().finally(() => {
      syncingRef.current = false
      setSyncing(false)
    })
  }

  // Aplica un modo (online/local) al backup y a la UI.
  const applyMode = async (mode) => {
    try { if (window.api?.backup?.setMode) await window.api.backup.setMode({ mode }) } catch {}
    setBackupConfig(c => ({ ...c, mode }))
  }

  // Memoriza el modo en que se cierra un proyecto (campo syncMode persistido).
  const persistMode = async (project, mode) => {
    if (!project?.id || project.syncMode === mode) return
    try { await useProjectStore.getState().save({ ...project, syncMode: mode }) } catch {}
  }

  // Switch maestro del sidebar: encender = sincronizar ya (sube local + baja nube).
  // No bloquea: la subida y la bajada corren en segundo plano con el aviso visible.
  const toggleSyncMode = async (nextMode) => {
    await applyMode(nextMode)
    await persistMode(activeProject, nextMode)
    if (nextMode === 'online') {
      try { window.api?.backup?.syncNow?.() } catch {}
      syncInBackground()
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      let cfg = null
      try { if (window.api?.backup?.getConfig) cfg = await window.api.backup.getConfig() } catch {}
      if (!active) return
      setBackupConfig(cfg)
      setBackupReady(true)
      if (cfg?.mode === 'online') {
        syncInBackground()
        // Retoma lo que quedó sin subir si el cierre anterior fue rápido.
        try { window.api?.backup?.syncNow?.() } catch {}
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const projects = useProjectStore(s => s.projects)
  const projectsLoaded = useProjectStore(s => s.loaded)
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null
  const strips = useStripStore(s => s.strips)
  const selectedStrip = selectedStripId ? strips.find(st => st.id === selectedStripId) || null : null
  const characters = useCharacterStore(s => s.characters)
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)

  const openProject = async (id) => {
    userStartedRef.current = true
    const globalMode = backupConfig?.mode || 'online'
    if (activeProject) await persistMode(activeProject, globalMode)
    const proj = projects.find(p => p.id === id)
    // Cada proyecto recuerda el modo del switch en que se cerró; sin memoria, hereda el global.
    const memorized = proj?.syncMode || globalMode
    await applyMode(memorized)
    try {
      if (window.api?.backup?.setActiveProject) {
        await window.api.backup.setActiveProject({ cloudBackup: proj?.cloudBackup !== false })
      }
    } catch {}
    // Abre al toque con lo que hay local; la sincronización corre en segundo plano
    // (aviso "actualizando...") mientras el usuario ya navega — stale-while-revalidate.
    setActiveProjectId(id)
    setSelectedStripId(null)
    setTiraReturnId(null)
    setView('strips')
    try { localStorage.setItem('doski:lastProject', id) } catch {}
    if (memorized === 'online') {
      syncInBackground()
    }
  }

  const exitProject = () => {
    userStartedRef.current = true
    setActiveProjectId(null)
    setTiraReturnId(null)
    setView('projects')
  }

  const navigate = (section) => {
    userStartedRef.current = true
    if (section === 'projects') { setView('projects'); return }
    if (!activeProject && SCOPED_VIEWS.includes(section) && section !== 'edit-project') return
    if (section === 'edit-project' && !activeProject) return
    if (section === 'export') useChatStore.getState().setOpen(false)
    setView(section)
  }

  // Al abrir: si la nube está encendida pero falta rclone o la cuenta, se abre el
  // paso a paso en lugar de abrir directamente el último proyecto.
  useEffect(() => {
    if (!projectsLoaded || !backupReady) return
    let active = true
    ;(async () => {
      if (userStartedRef.current) return
      let blocker = false
      if (backupConfig?.mode === 'online' && window.api?.backup?.setupStatus) {
        try {
          const diag = await window.api.backup.setupStatus()
          blocker = !diag.rcloneInstalled || !diag.remoteExists
        } catch {}
      }
      if (!active || userStartedRef.current) return
      if (blocker) { setView('sync'); return }
      let savedId = null
      try { savedId = localStorage.getItem('doski:lastProject') } catch {}
      const target = savedId && projects.find(p => p.id === savedId)
      if (target) {
        openProject(target.id)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsLoaded, backupReady])

  const closeSyncWizard = async () => {
    await applyMode('online')
    setView('projects')
  }

  // Informa al backup cuál es el proyecto activo (para la regla "modo Y proyecto").
  useEffect(() => {
    if (!window.api?.backup?.setActiveProject) return
    window.api.backup.setActiveProject({ cloudBackup: activeProject?.cloudBackup !== false })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, activeProject?.cloudBackup])

  const noProject = projectsLoaded && !activeProject

  const renderProjectList = () => (
    <ProjectList
      onOpen={openProject}
      onNew={() => { userStartedRef.current = true; setActiveProjectId(null); setView('edit-project') }}
      onEdit={(project) => {
        userStartedRef.current = true
        if (!project) { exitProject(); return }
        setActiveProjectId(project.id)
        setView('edit-project')
      }}
    />
  )

  const renderContent = () => {
    if (view === 'projects' || (noProject && SCOPED_VIEWS.includes(view))) {
      return renderProjectList()
    }

    switch (view) {
      case 'edit-project':
        return (
          <ProjectForm
            project={activeProject || null}
            onBack={() => activeProject ? setView('strips') : setView('projects')}
            onProjectChanged={(project) => openProject(project.id)}
            onDeleted={exitProject}
          />
        )

      case 'strips':
        return (
          <StripList
            project={activeProject}
            projectId={activeProjectId}
            initialOpenTiraId={tiraReturnId}
            onNew={() => setView('new-strip')}
            onEdit={(strip, tiraId) => { setTiraReturnId(tiraId || null); setSelectedStripId(strip.id); setView('editor'); setChatOpen(false) }}
          />
        )

      case 'new-strip':
        return (
          <StripCreator
            project={activeProject}
            onCreated={(strip, tiraId) => { setTiraReturnId(tiraId || null); setSelectedStripId(strip.id); setView('editor'); setChatOpen(false) }}
            onBack={() => setView('strips')}
          />
        )

      case 'editor':
        return selectedStrip && (
          <StripEditor
            key={selectedStrip.id}
            strip={selectedStrip}
            project={activeProject}
            onBack={() => setView('strips')}
            onEditCharacter={(char) => { setEditingCharacter(char); setView('edit-character') }}
            onShowPrompts={(strip, characters, balloons) => { setPromptData({ strip, characters, balloons }); setView('prompts'); setChatOpen(true) }}
          />
        )

      case 'prompts':
        return promptData && (
          <>
            <div className="section-header">
              <button className="back-arrow" onClick={() => { setPromptData(null); setView('editor'); setChatOpen(false) }}>←</button>
              <span className="ui-h2">prompts — {promptData.strip?.title || 'viñeta'}</span>
            </div>
            <PromptExporter strip={promptData.strip} characters={promptData.characters} project={activeProject} balloons={promptData.balloons || []} />
          </>
        )

      case 'export':
        return activeProject && (
          <PreviewExport
            project={activeProject}
            strips={strips.filter(s => s.projectId === activeProjectId)}
            characters={characters}
            backgrounds={backgrounds}
            objects={objects}
            focusStripId={selectedStripId}
            onGoToStrips={() => setView('strips')}
          />
        )

      case 'characters':
        return (
          <CharacterList
            projectId={activeProjectId}
            onNew={() => { setEditingCharacter(null); setView('edit-character') }}
            onEdit={(char) => { setEditingCharacter(char); setView('edit-character') }}
          />
        )

      case 'edit-character':
      case 'new-character':
        return (
          <CharacterForm
            character={editingCharacter}
            projectId={activeProjectId}
            onCancel={() => { setEditingCharacter(null); setView('characters') }}
          />
        )

      case 'backgrounds':
        return (
          <BackgroundList
            projectId={activeProjectId}
            onNew={() => { setEditingBackground(null); setView('edit-background') }}
            onEdit={(bg) => { setEditingBackground(bg); setView('edit-background') }}
          />
        )

      case 'edit-background':
      case 'new-background':
        return (
          <BackgroundForm
            background={editingBackground}
            projectId={activeProjectId}
            onCancel={() => { setEditingBackground(null); setView('backgrounds') }}
          />
        )

      case 'objects':
        return (
          <ObjectList
            projectId={activeProjectId}
            onNew={() => { setEditingObject(null); setView('edit-object') }}
            onEdit={(obj) => { setEditingObject(obj); setView('edit-object') }}
          />
        )

      case 'edit-object':
      case 'new-object':
        return (
          <ObjectForm
            object={editingObject}
            projectId={activeProjectId}
            onCancel={() => { setEditingObject(null); setView('objects') }}
          />
        )

      case 'balloons':
        return (
          <BalloonList
            projectId={activeProjectId}
            onNew={() => { setEditingBalloon(null); setView('edit-balloon') }}
            onEdit={(balloon) => { setEditingBalloon(balloon); setView('edit-balloon') }}
          />
        )

      case 'edit-balloon':
      case 'new-balloon':
        return (
          <BalloonForm
            balloon={editingBalloon}
            projectId={activeProjectId}
            onCancel={() => { setEditingBalloon(null); setView('balloons') }}
          />
        )

      case 'references':
        return (
          <ReferenceList
            projectId={activeProjectId}
            onNew={() => { setEditingReference(null); setView('edit-reference') }}
            onEdit={(ref) => { setEditingReference(ref); setView('edit-reference') }}
          />
        )

      case 'edit-reference':
      case 'new-reference':
        return (
          <ReferenceForm
            reference={editingReference}
            projectId={activeProjectId}
            onCancel={() => { setEditingReference(null); setView('references') }}
          />
        )

      case 'authors':
        return (
          <AuthorList
            onNew={() => { setEditingAuthor(null); setView('edit-author') }}
            onEdit={(author) => { setEditingAuthor(author); setView('edit-author') }}
          />
        )

      case 'edit-author':
      case 'new-author':
        return (
          <AuthorForm
            author={editingAuthor}
            onCancel={() => { setEditingAuthor(null); setView('authors') }}
          />
        )

      case 'modelo':
        return <ModelList />

      case 'sync':
        return (
          <SyncWizard
            onBack={() => setView('projects')}
            onDone={closeSyncWizard}
          />
        )

      default:
        return renderProjectList()
    }
  }

  return (
    <>
      <Layout currentView={view} onNavigate={navigate} activeProject={activeProject} onExitProject={exitProject} onToggleMode={toggleSyncMode}>
        <ErrorBoundary>{renderContent()}</ErrorBoundary>
      </Layout>
      {/* Aviso pequeño de sincronización: no bloquea la navegación */}
      {syncing && (
        <div style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10001,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: 12,
          color: 'var(--color-text-2)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
        }}>
          actualizando...
        </div>
      )}
      {/* Chat de IA persistente: vive fuera del contenido que cambia al navegar,
          así la conversación no se reinicia al cambiar de vista. */}
      <ChatPanel />
      <AutoSaveToast />
      <ConfirmDialog />
    </>
  )
}
