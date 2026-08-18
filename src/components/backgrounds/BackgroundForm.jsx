import { useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import SpellCheckedTextarea from '../SpellCheckedTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'
import { LANDSCAPE_EXTRACTOR_PROMPT } from '../../data/landscapeExtractorPrompt'
import { copyToClipboard } from '../../utils/clipboard'
import useAutoSaveBack from '../../utils/useAutoSaveBack'
import FormShade from '../FormShade'
import ChatLayout from '../chat/ChatLayout'

export default function BackgroundForm({ background, projectId, onCancel }) {
  const save = useBackgroundStore(s => s.save)
  const remove = useBackgroundStore(s => s.remove)
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const isNew = !background?.id

  const [name, setName] = useState(background?.name || '')
  const [promptText, setPromptText] = useState(background?.promptText || '')
  const [color, setColor] = useState(background?.color || '#6e6e73')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(background?.id || null)
  const [copied, setCopied] = useState(false)
  const [referenceImages, setReferenceImages] = useState(background?.referenceImages || [])
  const draftId = savedId || background?.id || 'draft-background'

  const copyExtractor = async () => {
    await copyToClipboard(LANDSCAPE_EXTRACTOR_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const updated = await save({ ...background, id: savedId || crypto.randomUUID(), projectId: background?.projectId || projectId, name, promptText, color, referenceImages })
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const payload = () => ({ ...background, id: savedId || crypto.randomUUID(), projectId: background?.projectId || projectId, name, promptText, color, referenceImages })
  const { goBack } = useAutoSaveBack({
    save,
    remove,
    payload,
    fields: ['name', 'promptText', 'color', 'referenceImages'],
    hasContent: !!name.trim(),
    getStored: (id) => backgrounds.find(b => b.id === id) || null,
    onBack: onCancel,
  })

  return (
    <ChatLayout>
      <div style={{ maxWidth: 520 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={goBack} title="volver">←</button>
          <h1 className="ui-h1">
            {isNew ? 'nuevo fondo' : 'editar fondo'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Bosque encantado"
            autoFocus
          />
        </div>

        <FormShade active={!!name.trim()} hint="colocá un nombre para poder editar el resto">
        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>prompt del fondo</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
              onClick={copyExtractor}
            >
              {copied ? 'copiado ✓' : 'copiar extractor'}
            </button>
          </div>
          <SpellCheckedTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describe el fondo: ambiente, iluminación, época, estilo..."
            minRows={4}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            pegá el "copiar extractor" en una IA multimodal junto con la imagen del paisaje, y pegá su respuesta acá.
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
        </FormShade>
      </form>
      </div>
    </ChatLayout>
  )
}
