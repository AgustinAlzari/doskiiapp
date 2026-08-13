import { useState } from 'react'
import useCharacterStore from '../../store/characterStore'
import AutoTextarea from '../editor/AutoTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'
import { CHARACTER_EXTRACTOR_PROMPT } from '../../data/characterExtractorPrompt'
import { copyToClipboard } from '../../utils/clipboard'
import ChatLayout from '../chat/ChatLayout'

export default function CharacterForm({ character, projectId, onCancel }) {
  const save = useCharacterStore(s => s.save)
  const isNew = !character?.id

  const [name, setName] = useState(character?.name || '')
  const [promptText, setPromptText] = useState(character?.promptText || '')
  const [color, setColor] = useState(character?.color || '#6e6e73')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(character?.id || null)
  const [copied, setCopied] = useState(false)
  const [referenceImages, setReferenceImages] = useState(character?.referenceImages || [])
  const draftId = savedId || character?.id || 'draft-character'

  const copyExtractor = async () => {
    await copyToClipboard(CHARACTER_EXTRACTOR_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const updated = await save({ ...character, id: savedId || crypto.randomUUID(), projectId: character?.projectId || projectId, name, promptText, color, referenceImages })
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <ChatLayout>
      <div style={{ maxWidth: 520 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={onCancel} title="volver">←</button>
          <h1 className="ui-h1">
            {isNew ? 'nuevo personaje' : 'editar personaje'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Carlos"
            autoFocus
          />
        </div>

        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>prompt del personaje</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
              onClick={copyExtractor}
            >
              {copied ? 'copiado ✓' : 'copiar extractor'}
            </button>
          </div>
          <AutoTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describe al personaje: apariencia, ropa, rasgos distintivos..."
            minRows={4}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            pegá el "copiar extractor" en una IA multimodal junto con la imagen del personaje, y pegá su respuesta acá.
          </div>
        </div>

        <div>
          <label className="label">color de identificación</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{color}</span>
          </div>
        </div>

        {name && (
          <div className="card" style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>preview: </span>
            <strong>{name}</strong>: {promptText || '...'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : savedFlash ? 'guardado ✓' : 'guardar'}
          </button>
        </div>
      </form>
      </div>
    </ChatLayout>
  )
}
