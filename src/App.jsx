import { useState } from 'react'
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
import ProjectList from './components/projects/ProjectList'
import ProjectForm from './components/projects/ProjectForm'
import PromptExporter from './components/export/PromptExporter'
import useProjectStore from './store/projectStore'
import useStripStore from './store/stripStore'

const SCOPED_VIEWS = [
  'strips', 'new-strip', 'editor', 'prompts',
  'characters', 'new-character', 'edit-character',
  'backgrounds', 'new-background', 'edit-background',
  'objects', 'new-object', 'edit-object',
]

export default function App() {
  const [view, setView] = useState('projects')
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [selectedStripId, setSelectedStripId] = useState(null)
  const [editingCharacter, setEditingCharacter] = useState(null)
  const [editingBackground, setEditingBackground] = useState(null)
  const [editingObject, setEditingObject] = useState(null)
  const [promptData, setPromptData] = useState(null)

  const projects = useProjectStore(s => s.projects)
  const projectsLoaded = useProjectStore(s => s.loaded)
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null
  const strips = useStripStore(s => s.strips)
  const selectedStrip = selectedStripId ? strips.find(st => st.id === selectedStripId) || null : null

  const openProject = (id) => {
    setActiveProjectId(id)
    setSelectedStripId(null)
    setView('strips')
  }

  const exitProject = () => {
    setActiveProjectId(null)
    setView('projects')
  }

  const navigate = (section) => {
    if (!activeProject && SCOPED_VIEWS.includes(section) && section !== 'edit-project') return
    if (section === 'edit-project' && !activeProject) return
    setView(section)
  }

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
            onShowPrompts={(strip, characters) => { setPromptData({ strip, characters }); setView('prompts') }}
          />
        )

      case 'prompts':
        return promptData && (
          <>
            <div className="editor-header" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 28, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border-muted)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPromptData(null); setView('editor') }}>←</button>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-title)' }}>prompts — {promptData.strip?.title || 'tira'}</span>
            </div>
            <PromptExporter strip={promptData.strip} characters={promptData.characters} project={activeProject} />
          </>
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
            onSaved={() => { setEditingCharacter(null); setView('characters') }}
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
            onSaved={() => { setEditingBackground(null); setView('backgrounds') }}
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
            onSaved={() => { setEditingObject(null); setView('objects') }}
            onCancel={() => { setEditingObject(null); setView('objects') }}
          />
        )

      default:
        return renderProjectList()
    }
  }

  return (
    <Layout currentView={view} onNavigate={navigate} activeProject={activeProject} onExitProject={exitProject}>
      <ErrorBoundary>{renderContent()}</ErrorBoundary>
    </Layout>
  )
}
