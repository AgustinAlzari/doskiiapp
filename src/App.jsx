import { useState } from 'react'
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

export default function App() {
  const [view, setView] = useState('strips')
  const [selectedStrip, setSelectedStrip] = useState(null)
  const [editingCharacter, setEditingCharacter] = useState(null)
  const [editingBackground, setEditingBackground] = useState(null)
  const [editingObject, setEditingObject] = useState(null)

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === 'strips' && (
        <StripList
          onNew={() => setView('new-strip')}
          onEdit={(strip) => { setSelectedStrip(strip); setView('editor') }}
        />
      )}

      {view === 'new-strip' && (
        <StripCreator
          onCreated={(strip) => { setSelectedStrip(strip); setView('editor') }}
          onBack={() => setView('strips')}
        />
      )}

      {view === 'editor' && selectedStrip && (
        <StripEditor
          strip={selectedStrip}
          onBack={() => setView('strips')}
          onEditCharacter={(char) => { setEditingCharacter(char); setView('edit-character') }}
        />
      )}

      {view === 'characters' && !editingCharacter && (
        <CharacterList
          onNew={() => { setEditingCharacter(null); setView('edit-character') }}
          onEdit={(char) => { setEditingCharacter(char); setView('edit-character') }}
        />
      )}

      {(view === 'new-character' || (view === 'edit-character')) && (
        <CharacterForm
          character={editingCharacter}
          onSaved={() => { setEditingCharacter(null); setView('characters') }}
          onCancel={() => { setEditingCharacter(null); setView('characters') }}
        />
      )}

      {view === 'backgrounds' && !editingBackground && (
        <BackgroundList
          onNew={() => { setEditingBackground(null); setView('edit-background') }}
          onEdit={(bg) => { setEditingBackground(bg); setView('edit-background') }}
        />
      )}

      {(view === 'new-background' || (view === 'edit-background')) && (
        <BackgroundForm
          background={editingBackground}
          onSaved={() => { setEditingBackground(null); setView('backgrounds') }}
          onCancel={() => { setEditingBackground(null); setView('backgrounds') }}
        />
      )}

      {view === 'objects' && !editingObject && (
        <ObjectList
          onNew={() => { setEditingObject(null); setView('edit-object') }}
          onEdit={(obj) => { setEditingObject(obj); setView('edit-object') }}
        />
      )}

      {(view === 'new-object' || (view === 'edit-object')) && (
        <ObjectForm
          object={editingObject}
          onSaved={() => { setEditingObject(null); setView('objects') }}
          onCancel={() => { setEditingObject(null); setView('objects') }}
        />
      )}
    </Layout>
  )
}
