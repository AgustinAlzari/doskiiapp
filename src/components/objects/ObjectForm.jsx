import { useState } from 'react'
import useObjectStore from '../../store/objectStore'
import ReferenceImagePicker from '../ReferenceImagePicker'
import { OBJECT_EXTRACTOR_PROMPT } from '../../data/objectExtractorPrompt'
import { copyToClipboard } from '../../utils/clipboard'
import useAutoSaveBack from '../../utils/useAutoSaveBack'
import FormShade from '../FormShade'
import ChatLayout from '../chat/ChatLayout'

export default function ObjectForm({ object, projectId, onCancel }) {
  const save = useObjectStore(s => s.save)
  const remove = useObjectStore(s => s.remove)
  const objects = useObjectStore(s => s.objects)
  const isNew = !object?.id

  const [name, setName] = useState(object?.name || '')
  const [promptText, setPromptText] = useState(object?.promptText || '')
  const [color, setColor] = useState(object?.color || '#6e6e73')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(object?.id || null)
  const [copied, setCopied] = useState(false)
  const [referenceImages, setReferenceImages] = useState(object?.referenceImages || [])
  const draftId = savedId || object?.id || 'draft-object'

  const copyExtractor = async () => {
    await copyToClipboard(OBJECT_EXTRACTOR_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const updated = await save({ ...object, id: savedId || crypto.randomUUID(), projectId: object?.projectId || projectId, name, promptText, color, referenceImages })
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const payload = () => ({ ...object, id: savedId || crypto.randomUUID(), projectId: object?.projectId || projectId, name, promptText, color, referenceImages })
  const { goBack } = useAutoSaveBack({
    save,
    remove,
    payload,
    fields: ['name', 'promptText', 'color', 'referenceImages'],
    hasContent: !!name.trim(),
    getStored: (id) => objects.find(o => o.id === id) || null,
    onBack: onCancel,
  })

  return (
    <ChatLayout>
      <div style={{ maxWidth: 520 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={goBack} title="volver">←</button>
          <h1 className="ui-h1">
            {isNew ? 'nuevo objeto' : 'editar objeto'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Lámpara vintage"
            autoFocus
          />
        </div>

        <FormShade active={!!name.trim()} hint="colocá un nombre para poder editar el resto">
        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>prompt del objeto</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
              onClick={copyExtractor}
            >
              {copied ? 'copiado ✓' : 'copiar extractor'}
            </button>
          </div>
          <textarea
            className="input textarea"
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describe el objeto: apariencia, material, tamaño, estilo..."
            rows={4}
            style={{ fontSize: 12, lineHeight: 1.5 }}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            pegá el "copiar extractor" en una IA multimodal junto con la imagen del objeto, y pegá su respuesta acá.
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
