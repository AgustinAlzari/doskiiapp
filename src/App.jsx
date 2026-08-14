import { useEffect, useState } from 'react'
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
import useCharacterStore from './store/characterStore'
import useBackgroundStore from './store/backgroundStore'
import useObjectStore from './store/objectStore'
import useBalloonStore from './store/balloonStore'
import usePaletteStore from './store/paletteStore'
import useAuthorStore from './store/authorStore'
import ChatPanel from './components/chat/ChatPanel'

const SCOPED_VIEWS = [
  'strips', 'new-strip', 'editor', 'prompts', 'export',
  'characters', 'new-character', 'edit-character',
  'backgrounds', 'new-background', 'edit-background',
  'objects', 'new-object', 'edit-object',
  'balloons', 'new-balloon', 'edit-balloon',
  'authors', 'new-author', 'edit-author',
]

export default function App() {
  const [view, setView] = useState('projects')
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [selectedStripId, setSelectedStripId] = useState(null)
  const [editingCharacter, setEditingCharacter] = useState(null)
  const [editingBackground, setEditingBackground] = useState(null)
  const [editingObject, setEditingObject] = useState(null)
  const [editingBalloon, setEditingBalloon] = useState(null)
  const [editingAuthor, setEditingAuthor] = useState(null)
  const [promptData, setPromptData] = useState(null)
  const [backupConfig, setBackupConfig] = useState(null)
  const [backupReady, setBackupReady] = useState(false)

  const reloadAllStores = async () => {
    await useProjectStore.getState().load()
    await useCharacterStore.getState().load()
    await useBackgroundStore.getState().load()
    await useObjectStore.getState().load()
    await useBalloonStore.getState().load()
    await useStripStore.getState().load()
    await usePaletteStore.getState().load()
    await useAuthorStore.getState().load()
  }

  const refreshAndReload = async () => {
    try {
      if (window.api?.backup?.refresh) await window.api.backup.refresh()
    } catch (e) { console.error('actualizar desde la nube falló:', e) }
    await reloadAllStores()
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
  const toggleSyncMode = async (nextMode) => {
    await applyMode(nextMode)
    await persistMode(activeProject, nextMode)
    if (nextMode === 'online') {
      try { if (window.api?.backup?.syncNow) await window.api.backup.syncNow() } catch {}
      await refreshAndReload()
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      let cfg = null
      try { if (window.api?.backup?.getConfig) cfg = await window.api.backup.getConfig() } catch {}
      if (!active) return
      setBackupConfig(cfg)
      if (cfg?.mode === 'online') await refreshAndReload()
      setBackupReady(true)
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
    const globalMode = backupConfig?.mode || 'online'
    if (activeProject) await persistMode(activeProject, globalMode)
    const proj = projects.find(p => p.id === id)
    // Cada proyecto recuerda el modo del switch en que se cerró; sin memoria, hereda el global.
    const memorized = proj?.syncMode || globalMode
    await applyMode(memorized)
    if (memorized === 'online') {
      await refreshAndReload()
    }
    try {
      if (window.api?.backup?.setActiveProject) {
        await window.api.backup.setActiveProject({ cloudBackup: proj?.cloudBackup !== false })
      }
    } catch {}
    setActiveProjectId(id)
    setSelectedStripId(null)
    setView('strips')
    try { localStorage.setItem('doski:lastProject', id) } catch {}
  }

  const exitProject = () => {
    setActiveProjectId(null)
    setView('projects')
  }

  const navigate = (section) => {
    if (section === 'projects') { setView('projects'); return }
    if (!activeProject && SCOPED_VIEWS.includes(section) && section !== 'edit-project') return
    if (section === 'edit-project' && !activeProject) return
    setView(section)
  }

  // Al abrir: si la nube está encendida pero falta rclone o la cuenta, se abre el
  // paso a paso en lugar de abrir directamente el último proyecto.
  useEffect(() => {
    if (!projectsLoaded || !backupReady) return
    let active = true
    ;(async () => {
      let blocker = false
      if (backupConfig?.mode === 'online' && window.api?.backup?.setupStatus) {
        try {
          const diag = await window.api.backup.setupStatus()
          blocker = !diag.rcloneInstalled || !diag.remoteExists
        } catch {}
      }
      if (!active) return
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
      onNew={() => { setActiveProjectId(null); setView('edit-project') }}
      onEdit={(project) => {
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
            onNew={() => setView('new-strip')}
            onEdit={(strip) => { setSelectedStripId(strip.id); setView('editor') }}
          />
        )

      case 'new-strip':
        return (
          <StripCreator
            project={activeProject}
            onCreated={(strip) => { setSelectedStripId(strip.id); setView('editor') }}
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
            onShowPrompts={(strip, characters, balloons) => { setPromptData({ strip, characters, balloons }); setView('prompts') }}
          />
        )

      case 'prompts':
        return promptData && (
          <>
            <div className="section-header">
              <button className="back-arrow" onClick={() => { setPromptData(null); setView('editor') }}>←</button>
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
      {/* Chat de IA persistente: vive fuera del contenido que cambia al navegar,
          así la conversación no se reinicia al cambiar de vista. */}
      <ChatPanel />
    </>
  )
}
